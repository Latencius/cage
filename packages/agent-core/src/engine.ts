import { requestLlmCompletion } from './llm.ts';
import { describeToolCall, findToolSpec, getToolsForMode } from './tools.ts';
import type {
  ChatMessage,
  ExecutionMode,
  HostBridge,
  LlmConfig,
  PendingApprovalView,
  TimelineEvent,
  ToolExecResult,
} from './types.ts';
import type { IsolatedVmController } from './e2b.ts';

export interface RunAgentOptions {
  prompt: string;
  history: ChatMessage[];
  llm: LlmConfig;
  mode: ExecutionMode;
  bridge: HostBridge;
  vm?: IsolatedVmController;
  maxSteps?: number;
  signal?: AbortSignal;
  onEvent: (event: TimelineEvent) => void;
  onApprovalRequired: (pending: PendingApprovalView) => Promise<boolean>;
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildSystemPrompt(mode: ExecutionMode, allowedDirs: string[]): string {
  if (mode === 'isolated_vm') {
    return [
      'You are Cage, a transparent and safety-first AI assistant operating inside an ISOLATED CLOUD VM.',
      'Your local host filesystem is completely unreachable in this mode.',
      'Use vm_screenshot, vm_launch_app, vm_click, vm_type, vm_press_key, and vm_bash to accomplish the user task.',
      'Always explain what you plan to do concisely in the user language (Japanese if the user writes Japanese).',
    ].join('\n');
  }

  return [
    'You are Cage, a local-first AI agent running inside a strict Rust security boundary.',
    `Allowed workspace directories: ${allowedDirs.length > 0 ? allowedDirs.join(', ') : '(NONE configured yet)'}.`,
    'You can ONLY access files inside the allowed directories. Any destructive or shell action requires explicit human approval.',
    'If a user denies an action, respect the decision immediately and propose a safer alternative.',
    'Always respond clearly in the user language (Japanese if the user writes Japanese).',
  ].join('\n');
}

export async function runAgentTurn(opts: RunAgentOptions): Promise<ChatMessage[]> {
  const {
    prompt,
    history,
    llm,
    mode,
    bridge,
    vm,
    maxSteps = 8,
    signal,
    onEvent,
    onApprovalRequired,
  } = opts;

  const policy = await bridge.getPolicy();
  const tools = getToolsForMode(mode);

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(mode, policy.allowedDirs) },
    ...history.filter((m) => m.role !== 'system'),
    { role: 'user', content: prompt },
  ];

  onEvent({
    id: makeId('evt'),
    timestamp: new Date().toISOString(),
    kind: 'user',
    title: 'ユーザー指示',
    detail: prompt,
  });

  for (let step = 0; step < maxSteps; step++) {
    if (signal?.aborted) {
      onEvent({
        id: makeId('evt'),
        timestamp: new Date().toISOString(),
        kind: 'error',
        title: '実行が中断されました',
      });
      break;
    }

    const response = await requestLlmCompletion(llm, messages, tools, bridge.proxyHttp);

    if (response.content.trim() && response.toolCalls.length > 0) {
      onEvent({
        id: makeId('evt'),
        timestamp: new Date().toISOString(),
        kind: 'thought',
        title: 'エージェントの思考',
        detail: response.content.trim(),
      });
    }

    if (response.toolCalls.length === 0) {
      messages.push({ role: 'assistant', content: response.content });
      onEvent({
        id: makeId('evt'),
        timestamp: new Date().toISOString(),
        kind: 'assistant',
        title: '回答',
        detail: response.content,
      });
      return messages;
    }

    messages.push({
      role: 'assistant',
      content: response.content,
      tool_calls: response.toolCalls,
    });

    for (const tc of response.toolCalls) {
      const toolName = tc.function.name;
      const spec = findToolSpec(toolName);
      let args: Record<string, unknown> = {};
      try {
        args = tc.function.arguments ? (JSON.parse(tc.function.arguments) as Record<string, unknown>) : {};
      } catch {
        args = {};
      }

      if (!spec) {
        const errMsg = `Unknown tool requested: ${toolName}`;
        messages.push({ role: 'tool', tool_call_id: tc.id, name: toolName, content: errMsg });
        onEvent({
          id: makeId('evt'),
          timestamp: new Date().toISOString(),
          kind: 'error',
          title: errMsg,
          toolName,
        });
        continue;
      }

      const summary = describeToolCall(toolName, args);
      const latestPolicy = await bridge.getPolicy();
      const permLevel = latestPolicy.permissions[spec.category] ?? 'deny';

      onEvent({
        id: makeId('evt'),
        timestamp: new Date().toISOString(),
        kind: 'tool_call',
        title: summary,
        toolName,
        category: spec.category,
        risk: spec.risk,
        args,
      });

      if (permLevel === 'deny') {
        const msg = `BLOCKED_BY_POLICY: '${toolName}' (${spec.category}) is disabled in Safety Settings.`;
        messages.push({ role: 'tool', tool_call_id: tc.id, name: toolName, content: msg });
        onEvent({
          id: makeId('evt'),
          timestamp: new Date().toISOString(),
          kind: 'approval_denied',
          title: `ポリシーにより遮断: ${toolName}`,
          detail: msg,
          toolName,
          category: spec.category,
          risk: spec.risk,
        });
        continue;
      }

      let approvalToken: string | undefined;

      if (permLevel === 'require_approval') {
        const challenge = await bridge.requestApproval(toolName, spec.category, summary, args);
        onEvent({
          id: makeId('evt'),
          timestamp: new Date().toISOString(),
          kind: 'approval_pending',
          title: `承認待ち: ${summary}`,
          toolName,
          category: spec.category,
          risk: spec.risk,
          args,
        });

        const approved = await onApprovalRequired({
          challenge,
          toolName,
          category: spec.category,
          risk: spec.risk,
          args,
          summary,
        });

        if (!approved) {
          await bridge.denyRequest(challenge.approvalId);
          const msg = `DENIED_BY_USER: The human operator declined '${toolName}'. Do not retry the same action without asking.`;
          messages.push({ role: 'tool', tool_call_id: tc.id, name: toolName, content: msg });
          onEvent({
            id: makeId('evt'),
            timestamp: new Date().toISOString(),
            kind: 'approval_denied',
            title: `ユーザーが拒否: ${summary}`,
            toolName,
            category: spec.category,
            risk: spec.risk,
          });
          continue;
        }

        const grant = await bridge.approveRequest(challenge.approvalId);
        approvalToken = grant.approvalToken;
        onEvent({
          id: makeId('evt'),
          timestamp: new Date().toISOString(),
          kind: 'approval_granted',
          title: `承認済み（ワンタイムトークン発行）: ${toolName}`,
          toolName,
          category: spec.category,
          risk: spec.risk,
        });
      }

      let execResult: ToolExecResult;
      try {
        if (spec.mode === 'isolated_vm') {
          if (!vm) {
            execResult = { ok: false, output: 'VM controller not attached.', truncated: false };
          } else {
            execResult = await vm.executeTool(toolName, args);
          }
        } else {
          execResult = await bridge.executeLocalTool(toolName, args, approvalToken);
        }
      } catch (err) {
        execResult = {
          ok: false,
          output: err instanceof Error ? err.message : String(err),
          truncated: false,
        };
      }

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        name: toolName,
        content: execResult.output,
      });

      onEvent({
        id: makeId('evt'),
        timestamp: new Date().toISOString(),
        kind: 'tool_result',
        title: execResult.ok ? `実行完了: ${toolName}` : `実行エラー: ${toolName}`,
        detail: execResult.output,
        toolName,
        category: spec.category,
        risk: spec.risk,
        ok: execResult.ok,
        screenshotBase64: execResult.screenshotBase64,
      });
    }
  }

  return messages;
}
