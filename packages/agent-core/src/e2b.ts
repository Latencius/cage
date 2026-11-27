import type { ToolExecResult, VmSessionState } from './types.ts';

interface E2BDesktopInstance {
  sandboxId: string;
  stream: {
    start: (opts?: { requireAuth?: boolean }) => Promise<void>;
    getAuthKey: () => string;
    getUrl: (opts?: { authKey?: string; viewOnly?: boolean }) => string;
  };
  screenshot: (format?: 'bytes' | 'stream') => Promise<Uint8Array>;
  leftClick: (x?: number, y?: number) => Promise<void>;
  write: (text: string) => Promise<void>;
  press: (key: string | string[]) => Promise<void>;
  launch: (app: string) => Promise<void>;
  commands: {
    run: (cmd: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  };
  kill: () => Promise<void>;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Wraps @e2b/desktop for Cage's Isolated VM Mode.
 * Supports real E2B Desktop Sandboxes with live noVNC streaming and Human Takeover toggle.
 */
export class IsolatedVmController {
  private sandbox: E2BDesktopInstance | null = null;
  private state: VmSessionState = {
    status: 'idle',
    sandboxId: null,
    streamUrl: null,
    interactiveStreamUrl: null,
    takeover: false,
  };

  getState(): VmSessionState {
    return { ...this.state };
  }

  setTakeover(takeover: boolean): VmSessionState {
    this.state = { ...this.state, takeover };
    return this.getState();
  }

  async start(apiKey: string): Promise<VmSessionState> {
    if (!apiKey.trim()) {
      this.state = {
        status: 'error',
        sandboxId: null,
        streamUrl: null,
        interactiveStreamUrl: null,
        takeover: false,
        error: 'E2B APIキーが設定されていません。接続設定から E2B_API_KEY を入力してください。',
      };
      return this.getState();
    }

    this.state = {
      status: 'starting',
      sandboxId: null,
      streamUrl: null,
      interactiveStreamUrl: null,
      takeover: false,
    };

    try {
      const mod = await import('@e2b/desktop');
      const SandboxClass = mod.Sandbox as unknown as {
        create: (opts: { apiKey: string; resolution?: [number, number]; timeoutMs?: number }) => Promise<E2BDesktopInstance>;
      };

      const desktop = await SandboxClass.create({
        apiKey: apiKey.trim(),
        resolution: [1280, 800],
        timeoutMs: 10 * 60 * 1000,
      });

      await desktop.stream.start({ requireAuth: true });
      const authKey = desktop.stream.getAuthKey();
      const viewOnlyUrl = desktop.stream.getUrl({ authKey, viewOnly: true });
      const interactiveUrl = desktop.stream.getUrl({ authKey, viewOnly: false });

      this.sandbox = desktop;
      this.state = {
        status: 'running',
        sandboxId: desktop.sandboxId,
        streamUrl: viewOnlyUrl,
        interactiveStreamUrl: interactiveUrl,
        takeover: false,
      };
      return this.getState();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.state = {
        status: 'error',
        sandboxId: null,
        streamUrl: null,
        interactiveStreamUrl: null,
        takeover: false,
        error: `E2B Desktop 起動に失敗しました: ${message}`,
      };
      return this.getState();
    }
  }

  async stop(): Promise<VmSessionState> {
    if (this.sandbox) {
      try {
        await this.sandbox.kill();
      } catch {
        // Ignore teardown errors
      }
      this.sandbox = null;
    }
    this.state = {
      status: 'idle',
      sandboxId: null,
      streamUrl: null,
      interactiveStreamUrl: null,
      takeover: false,
    };
    return this.getState();
  }

  async executeTool(toolName: string, args: Record<string, unknown>): Promise<ToolExecResult> {
    if (!this.sandbox) {
      return {
        ok: false,
        output: '隔離VMが起動していません。右ペインの「隔離VMを起動」ボタンで E2B Desktop を起動してください。',
        truncated: false,
      };
    }

    try {
      switch (toolName) {
        case 'vm_screenshot': {
          const bytes = await this.sandbox.screenshot('bytes');
          return {
            ok: true,
            output: `Captured VM screenshot (${bytes.byteLength} bytes).`,
            truncated: false,
            screenshotBase64: bytesToBase64(bytes),
          };
        }
        case 'vm_launch_app': {
          const app = String(args.app ?? '');
          await this.sandbox.launch(app);
          return { ok: true, output: `Launched '${app}' in isolated VM.`, truncated: false };
        }
        case 'vm_click': {
          const x = Number(args.x ?? 0);
          const y = Number(args.y ?? 0);
          await this.sandbox.leftClick(x, y);
          return { ok: true, output: `Clicked (${x}, ${y}) in isolated VM.`, truncated: false };
        }
        case 'vm_type': {
          const text = String(args.text ?? '');
          await this.sandbox.write(text);
          return { ok: true, output: `Typed ${text.length} characters in isolated VM.`, truncated: false };
        }
        case 'vm_press_key': {
          const key = String(args.key ?? 'Return');
          await this.sandbox.press(key);
          return { ok: true, output: `Pressed key '${key}' in isolated VM.`, truncated: false };
        }
        case 'vm_bash': {
          const cmd = String(args.command ?? '');
          const res = await this.sandbox.commands.run(cmd);
          return {
            ok: res.exitCode === 0,
            output: `exit_code: ${res.exitCode}\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`,
            truncated: false,
          };
        }
        default:
          return { ok: false, output: `Unknown VM tool: ${toolName}`, truncated: false };
      }
    } catch (err) {
      return {
        ok: false,
        output: `VM tool '${toolName}' error: ${err instanceof Error ? err.message : String(err)}`,
        truncated: false,
      };
    }
  }
}
