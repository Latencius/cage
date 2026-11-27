import type {
  OpenClawConfig,
  OpenClawConnectionState,
  PendingApprovalView,
  TimelineEvent,
} from './types.ts';

interface GatewayFrame {
  type: 'req' | 'res' | 'event';
  id?: string;
  method?: string;
  event?: string;
  ok?: boolean;
  params?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  error?: { code?: string | number; message?: string };
  seq?: number;
}

interface PendingRpc {
  resolve: (payload: Record<string, unknown>) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Native OpenClaw Gateway WebSocket Protocol (v3 / v4) client.
 * Implements:
 *   1) Server `event: connect.challenge` -> Client first frame `req: connect` -> Server `res: hello-ok`
 *   2) Multiplexed RPC requests (`agent`, `chat.send`, `approval.respond`)
 *   3) Real-time event stream (`event: agent`, `event: exec.approval` / `approval.request`)
 */
export class OpenClawClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, PendingRpc>();
  private eventListeners = new Set<(frame: GatewayFrame) => void>();
  private state: OpenClawConnectionState = {
    status: 'disconnected',
    protocol: null,
    serverNote: null,
  };

  getState(): OpenClawConnectionState {
    return { ...this.state };
  }

  isConnected(): boolean {
    return this.state.status === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  async connect(config: OpenClawConfig): Promise<OpenClawConnectionState> {
    this.disconnect();
    const wsUrl = config.wsUrl.trim();
    if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
      this.state = {
        status: 'error',
        protocol: null,
        serverNote: null,
        error: 'OpenClaw Gateway URL must start with ws:// or wss://',
      };
      return this.getState();
    }

    this.state = { status: 'connecting', protocol: null, serverNote: null };

    return new Promise<OpenClawConnectionState>((resolve) => {
      let settled = false;
      let connectSent = false;
      let challengeTimer: ReturnType<typeof setTimeout> | null = null;
      let handshakeTimer: ReturnType<typeof setTimeout> | null = null;

      const finish = (next: OpenClawConnectionState) => {
        if (settled) return;
        settled = true;
        if (challengeTimer) clearTimeout(challengeTimer);
        if (handshakeTimer) clearTimeout(handshakeTimer);
        this.state = next;
        resolve(this.getState());
      };

      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch (err) {
        finish({
          status: 'error',
          protocol: null,
          serverNote: null,
          error: err instanceof Error ? err.message : String(err),
        });
        return;
      }

      this.ws = ws;
      const connectReqId = makeId('req_connect');

      const sendConnectFrame = (nonce?: string, ts?: number) => {
        if (connectSent || ws.readyState !== WebSocket.OPEN) return;
        connectSent = true;
        if (challengeTimer) clearTimeout(challengeTimer);

        const params: Record<string, unknown> = {
          minProtocol: 3,
          maxProtocol: 4,
          client: {
            id: 'cage-desktop',
            version: '0.2.0',
            platform: typeof navigator !== 'undefined' ? navigator.platform : 'node',
            mode: 'operator',
          },
          role: 'operator',
          scopes: ['operator.read', 'operator.write'],
          caps: ['approvals'],
          commands: [],
          permissions: {},
          locale: 'en-US',
          userAgent: 'cage-desktop/0.2.0',
        };

        if (config.token.trim()) {
          params.auth = { token: config.token.trim() };
        }
        if (nonce) {
          params.device = {
            id: 'cage-operator-device',
            signedAt: ts ?? Date.now(),
            nonce,
          };
        }

        const frame: GatewayFrame = {
          type: 'req',
          id: connectReqId,
          method: 'connect',
          params,
        };
        ws.send(JSON.stringify(frame));
      };

      ws.addEventListener('open', () => {
        // Wait briefly for server's `connect.challenge`; if the gateway doesn't send one, send `connect` directly
        challengeTimer = setTimeout(() => sendConnectFrame(), 600);
      });

      ws.addEventListener('message', (ev) => {
        let frame: GatewayFrame;
        try {
          frame = JSON.parse(String(ev.data)) as GatewayFrame;
        } catch {
          return;
        }

        if (frame.type === 'event' && frame.event === 'connect.challenge') {
          const nonce = typeof frame.payload?.nonce === 'string' ? frame.payload.nonce : undefined;
          const ts = typeof frame.payload?.ts === 'number' ? frame.payload.ts : undefined;
          sendConnectFrame(nonce, ts);
          return;
        }

        if (frame.type === 'res' && frame.id === connectReqId) {
          if (frame.ok) {
            const proto =
              typeof frame.payload?.protocol === 'number' ? frame.payload.protocol : 4;
            const ptype =
              typeof frame.payload?.type === 'string' ? frame.payload.type : 'hello-ok';
            finish({
              status: 'connected',
              protocol: proto,
              serverNote: `${ptype} (protocol v${proto})`,
            });
          } else {
            const msg = frame.error?.message ?? 'OpenClaw Gateway rejected connect handshake';
            ws.close();
            finish({
              status: 'error',
              protocol: null,
              serverNote: null,
              error: msg,
            });
          }
          return;
        }

        if (frame.type === 'res' && frame.id) {
          const entry = this.pending.get(frame.id);
          if (entry) {
            this.pending.delete(frame.id);
            clearTimeout(entry.timer);
            if (frame.ok) {
              entry.resolve(frame.payload ?? {});
            } else {
              entry.reject(
                new Error(frame.error?.message ?? `OpenClaw RPC failed (${frame.id})`),
              );
            }
          }
          return;
        }

        if (frame.type === 'event') {
          for (const listener of this.eventListeners) {
            listener(frame);
          }
        }
      });

      ws.addEventListener('error', () => {
        finish({
          status: 'error',
          protocol: null,
          serverNote: null,
          error: `Failed to connect to OpenClaw Gateway at ${wsUrl}`,
        });
      });

      ws.addEventListener('close', () => {
        for (const [, entry] of this.pending) {
          clearTimeout(entry.timer);
          entry.reject(new Error('OpenClaw Gateway connection closed'));
        }
        this.pending.clear();
        if (!settled) {
          finish({
            status: 'error',
            protocol: null,
            serverNote: null,
            error: `OpenClaw Gateway closed connection before handshake completed`,
          });
        } else if (this.state.status === 'connected') {
          this.state = {
            status: 'disconnected',
            protocol: null,
            serverNote: null,
          };
        }
      });

      // Safety handshake timeout
      handshakeTimer = setTimeout(() => {
        if (!settled) {
          ws.close();
          finish({
            status: 'error',
            protocol: null,
            serverNote: null,
            error: 'OpenClaw Gateway handshake timed out after 8s',
          });
        }
      }, 8_000);
    });
  }

  disconnect() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.pending.clear();
    this.state = { status: 'disconnected', protocol: null, serverNote: null };
  }

  request(
    method: string,
    params: Record<string, unknown>,
    timeoutMs = 90_000,
  ): Promise<Record<string, unknown>> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('Not connected to OpenClaw Gateway'));
    }
    const id = makeId('req');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`OpenClaw RPC '${method}' timed out`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      this.ws!.send(
        JSON.stringify({
          type: 'req',
          id,
          method,
          params,
        } satisfies GatewayFrame),
      );
    });
  }

  async runPrompt(opts: {
    prompt: string;
    config: OpenClawConfig;
    onEvent: (event: TimelineEvent) => void;
    onApprovalRequired: (pending: PendingApprovalView) => Promise<boolean>;
  }): Promise<string> {
    const { prompt, config, onEvent, onApprovalRequired } = opts;

    onEvent({
      id: makeId('evt'),
      timestamp: new Date().toISOString(),
      kind: 'user',
      title: 'User Prompt',
      detail: prompt,
    });

    if (config.requireSendApproval) {
      const approved = await onApprovalRequired({
        challenge: {
          approvalId: makeId('oc_send'),
          toolName: 'openclaw.agent',
          category: 'shell_exec',
          summary: `Dispatch prompt to OpenClaw Gateway (${config.wsUrl})`,
          argsHash: 'openclaw-dispatch',
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
        },
        toolName: 'openclaw.agent',
        category: 'shell_exec',
        risk: 'medium',
        args: { sessionKey: config.sessionKey || 'default', prompt },
        summary: `Send task to OpenClaw Gateway (${config.sessionKey || 'default'})`,
      });
      if (!approved) {
        onEvent({
          id: makeId('evt'),
          timestamp: new Date().toISOString(),
          kind: 'approval_denied',
          title: 'Operator blocked OpenClaw dispatch at Cage Gate',
        });
        return '';
      }
      onEvent({
        id: makeId('evt'),
        timestamp: new Date().toISOString(),
        kind: 'approval_granted',
        title: 'Approved OpenClaw Gateway dispatch',
      });
    }

    if (!this.isConnected()) {
      const st = await this.connect(config);
      if (st.status !== 'connected') {
        throw new Error(st.error ?? 'Unable to connect to OpenClaw Gateway');
      }
    }

    let streamedText = '';

    const listener = (frame: GatewayFrame) => {
      const eventName = frame.event ?? '';
      const payload = frame.payload ?? {};

      // Intercept OpenClaw approval requests and route through Cage's Glass Approval Gate
      if (
        eventName === 'exec.approval' ||
        eventName === 'approval.request' ||
        eventName === 'exec.approval.requested'
      ) {
        const approvalId = String(payload.approvalId ?? payload.id ?? makeId('oc_apr'));
        const toolName = String(payload.tool ?? payload.command ?? 'openclaw.exec');
        const summary = String(payload.summary ?? `OpenClaw requests approval: ${toolName}`);
        onEvent({
          id: makeId('evt'),
          timestamp: new Date().toISOString(),
          kind: 'approval_pending',
          title: `OpenClaw awaiting approval: ${summary}`,
          toolName,
        });

        onApprovalRequired({
          challenge: {
            approvalId,
            toolName,
            category: 'shell_exec',
            summary,
            argsHash: approvalId.slice(0, 12),
            expiresAt: new Date(Date.now() + 300_000).toISOString(),
          },
          toolName,
          category: 'shell_exec',
          risk: 'high',
          args: payload,
          summary,
        }).then((approved) => {
          onEvent({
            id: makeId('evt'),
            timestamp: new Date().toISOString(),
            kind: approved ? 'approval_granted' : 'approval_denied',
            title: approved
              ? `Approved OpenClaw action: ${toolName}`
              : `Denied OpenClaw action: ${toolName}`,
          });
          this.request('exec.approval.resolve', {
            approvalId,
            approved,
          }).catch(() => {
            // Gateway may use alternate resolution or already closed
          });
        });
        return;
      }

      if (eventName === 'agent' || eventName.startsWith('agent.') || eventName.startsWith('chat.')) {
        const kind = String(payload.type ?? payload.kind ?? '');
        const text =
          typeof payload.delta === 'string'
            ? payload.delta
            : typeof payload.text === 'string'
              ? payload.text
              : typeof payload.content === 'string'
                ? payload.content
                : '';

        if (kind === 'tool_call' || payload.tool) {
          onEvent({
            id: makeId('evt'),
            timestamp: new Date().toISOString(),
            kind: 'tool_call',
            title: `OpenClaw tool: ${String(payload.tool ?? payload.name ?? 'action')}`,
            detail: payload.arguments ? JSON.stringify(payload.arguments) : text || undefined,
          });
        } else if (kind === 'thought' || kind === 'status') {
          onEvent({
            id: makeId('evt'),
            timestamp: new Date().toISOString(),
            kind: 'thought',
            title: 'OpenClaw',
            detail: text || JSON.stringify(payload),
          });
        } else if (text) {
          streamedText += text;
        }
      }
    };

    this.eventListeners.add(listener);
    try {
      const resPayload = await this.request('agent', {
        idempotencyKey: makeId('idemp'),
        sessionKey: config.sessionKey.trim() || 'cage-main',
        prompt,
        options: { expectFinal: true },
      });

      const finalText =
        (typeof resPayload.output === 'string' && resPayload.output) ||
        (typeof resPayload.text === 'string' && resPayload.text) ||
        (typeof resPayload.message === 'string' && resPayload.message) ||
        streamedText ||
        JSON.stringify(resPayload, null, 2);

      onEvent({
        id: makeId('evt'),
        timestamp: new Date().toISOString(),
        kind: 'assistant',
        title: 'OpenClaw',
        detail: finalText,
      });

      return finalText;
    } finally {
      this.eventListeners.delete(listener);
    }
  }
}
