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
          '承知しました。承認ゲートで拒否されたため操作を中止しました。別の安全なアプローチが必要でしたら指示してください。',
        toolCalls: [],
      };
    }
    return {
      content: `操作が完了しました！実行結果を確認してください：\n\n\`\`\`\n${content.slice(0, 600)}\n\`\`\`\n\n（現在はオフライン・デモモードで動作しています。上部の「接続設定」から Ollama / LM Studio や APIキーを繋ぐと実モデルで自律実行できます）`,
      toolCalls: [],
    };
  }

  const userText = lastMsg.content;

  if (isVmMode) {
    if (userText.includes('画面') || userText.includes('スクリーン')) {
      return {
        content: '隔離VMの現在のデスクトップ画面をキャプチャして確認します。',
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
      content: '隔離VM内で安全にコマンドを実行し、環境を確認します。',
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

  if (userText.includes('削除') || userText.includes('消して') || userText.includes('delete')) {
    return {
      content: 'ファイル削除は高リスク操作のため、Rust安全境界の承認ゲートを起動します。',
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

  if (userText.includes('作成') || userText.includes('書') || userText.includes('レポート') || userText.includes('メモ')) {
    return {
      content: '許可フォルダ内にレポートファイルを作成します。書き込み前に承認を確認してください。',
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

  if (userText.includes('シェル') || userText.includes('コマンド') || userText.includes('shell')) {
    return {
      content: 'ワークスペース内で安全なシェルコマンドを実行します。実行前に承認してください。',
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
    content: 'まず許可フォルダの中身を確認します（読み取りはデフォルトで自動許可されます）。',
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
