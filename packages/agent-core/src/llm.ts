import type { ChatMessage, HttpProxyFn, LlmConfig, ParsedToolCall } from './types.ts';
import type { ToolSpec } from './tools.ts';
import { toOpenAiTools } from './tools.ts';

export interface LlmResponse {
  content: string;
  toolCalls: ParsedToolCall[];
}

/**
 * Fallback parser for small local LLMs (8B-32B) that emit JSON tool calls in markdown
 * instead of native OpenAI `tool_calls`.
 */
export function extractFallbackToolCalls(text: string, allowedToolNames: Set<string>): ParsedToolCall[] {
  const results: ParsedToolCall[] = [];
  const fencedRegex = /```(?:json|tool_call)?\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = fencedRegex.exec(text)) !== null) {
    const candidate = match[1].trim();
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const name = (parsed.tool ?? parsed.name) as string | undefined;
      const args = (parsed.arguments ?? parsed.args ?? {}) as Record<string, unknown>;
      if (name && allowedToolNames.has(name)) {
        results.push({
          id: `fallback_${Date.now()}_${idx++}`,
          type: 'function',
          function: {
            name,
            arguments: JSON.stringify(args),
          },
        });
      }
    } catch {
      // Ignore non-JSON code blocks
    }
  }

  return results;
}

/**
 * Built-in offline walkthrough mode so first-time users can experience the safety boundary
 * and approval gate even before installing Ollama or adding an API key.
 */
function runDemoCompletion(messages: ChatMessage[], tools: ToolSpec[]): LlmResponse {
  const lastMsg = messages[messages.length - 1];
  const isVmMode = tools.some((t) => t.name.startsWith('vm_'));

  if (lastMsg.role === 'tool') {
    const content = lastMsg.content;
    if (content.includes('DENIED_BY_USER')) {
      return {
        content:
          'Understood. The action was aborted at the Approval Gate. Let me know if you would like a safer alternative.',
        toolCalls: [],
      };
    }
    return {
      content: `Done! Here is the tool output:\n\n\`\`\`\n${content.slice(0, 600)}\n\`\`\`\n\n(Currently running in Offline Demo Mode. Open Connections to link Ollama, LM Studio, or any OpenAI-compatible API.)`,
      toolCalls: [],
    };
  }

  const userText = lastMsg.content;
  const lower = userText.toLowerCase();

  if (isVmMode) {
    if (lower.includes('screenshot') || userText.includes('画面') || userText.includes('截')) {
      return {
        content: 'Capturing a screenshot of the isolated cloud desktop VM.',
        toolCalls: [
          {
            id: `demo_${Date.now()}`,
            type: 'function',
            function: { name: 'vm_screenshot', arguments: '{}' },
          },
        ],
      };
    }
    return {
      content: 'Running an inspection command safely inside the isolated cloud VM.',
      toolCalls: [
        {
          id: `demo_${Date.now()}`,
          type: 'function',
          function: {
            name: 'vm_bash',
            arguments: JSON.stringify({ command: 'uname -a && ls -la ~/Desktop' }),
          },
        },
      ],
    };
  }

  if (
    lower.includes('delete') ||
    lower.includes('remove') ||
    userText.includes('削除') ||
    userText.includes('消して') ||
    userText.includes('删除')
  ) {
    return {
      content:
        'File deletion is a high-risk operation — pausing at the Rust Approval Gate for your confirmation.',
      toolCalls: [
        {
          id: `demo_${Date.now()}`,
          type: 'function',
          function: {
            name: 'delete_file',
            arguments: JSON.stringify({ path: 'temp-draft.txt' }),
          },
        },
      ],
    };
  }

  if (
    lower.includes('create') ||
    lower.includes('write') ||
    lower.includes('report') ||
    userText.includes('作成') ||
    userText.includes('レポート') ||
    userText.includes('创建')
  ) {
    return {
      content:
        'Preparing to create a report inside your allowed folder. Please review and approve the write.',
      toolCalls: [
        {
          id: `demo_${Date.now()}`,
          type: 'function',
          function: {
            name: 'write_file',
            arguments: JSON.stringify({
              path: 'cage-summary.md',
              content: `# Cage Safety Report\n\nGenerated in Local Mode.\nPrompt: ${userText}\n`,
            }),
          },
        },
      ],
    };
  }

  if (
    lower.includes('shell') ||
    lower.includes('command') ||
    userText.includes('シェル') ||
    userText.includes('コマンド') ||
    userText.includes('命令')
  ) {
    return {
      content: 'Requesting approval to run a workspace shell command.',
      toolCalls: [
        {
          id: `demo_${Date.now()}`,
          type: 'function',
          function: {
            name: 'run_shell',
            arguments: JSON.stringify({ command: 'ls -la && pwd' }),
          },
        },
      ],
    };
  }

  return {
    content: 'Inspecting the allowed workspace folder (directory listing is auto-allowed by default).',
    toolCalls: [
      {
        id: `demo_${Date.now()}`,
        type: 'function',
        function: {
          name: 'list_dir',
          arguments: JSON.stringify({ path: '.' }),
        },
      },
    ],
  };
}

export async function requestLlmCompletion(
  config: LlmConfig,
  messages: ChatMessage[],
  tools: ToolSpec[],
  proxyHttp?: HttpProxyFn,
): Promise<LlmResponse> {
  if (config.demoMode || !config.baseUrl) {
    return runDemoCompletion(messages, tools);
  }

  const endpoint = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey.trim()) {
    headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
  }

  const payload = {
    model: config.model,
    messages,
    tools: toOpenAiTools(tools),
    tool_choice: 'auto',
    temperature: 0.2,
  };

  let status = 0;
  let ok = false;
  let bodyText = '';

  if (proxyHttp) {
    const res = await proxyHttp({
      url: endpoint,
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      timeoutMs: 90_000,
    });
    status = res.status;
    ok = res.ok;
    bodyText = res.body;
  } else {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    status = res.status;
    ok = res.ok;
    bodyText = await res.text();
  }

  if (!ok) {
    throw new Error(`LLM API error (${status}): ${bodyText.slice(0, 400)}`);
  }

  const data = JSON.parse(bodyText) as {
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: ParsedToolCall[];
      };
    }>;
  };

  const msg = data.choices?.[0]?.message;
  const content = msg?.content ?? '';
  let toolCalls = msg?.tool_calls ?? [];

  if (toolCalls.length === 0 && content) {
    const allowed = new Set(tools.map((t) => t.name));
    toolCalls = extractFallbackToolCalls(content, allowed);
  }

  return { content, toolCalls };
}
