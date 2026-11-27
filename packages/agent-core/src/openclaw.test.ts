import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import type { Duplex } from 'node:stream';
import { OpenClawClient } from './openclaw.ts';
import { runAgentTurn } from './engine.ts';
import type { HostBridge, SecurityPolicy, TimelineEvent } from './types.ts';

/**
 * Minimal RFC 6455 WebSocket server (zero external deps) implementing the real
 * OpenClaw Gateway v4 protocol:
 *   - Sends `event: connect.challenge` on open
 *   - Validates first frame `req: connect` + token + nonce -> replies `res: hello-ok`
 *   - Handles `req: agent` -> emits `event: exec.approval` -> waits for `exec.approval.resolve`
 *     -> streams `event: agent` -> replies final `res`
 */
function startMockOpenClawGateway(expectedToken: string): Promise<{
  url: string;
  close: () => Promise<void>;
  getLastApprovalDecision: () => boolean | null;
}> {
  let lastApprovalDecision: boolean | null = null;

  function encodeTextFrame(text: string): Buffer {
    const payload = Buffer.from(text, 'utf8');
    const len = payload.length;
    if (len < 126) {
      return Buffer.concat([Buffer.from([0x81, len]), payload]);
    }
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
    return Buffer.concat([header, payload]);
  }

  function decodeClientFrames(buf: Buffer): { messages: string[]; rest: Buffer } {
    const messages: string[] = [];
    let offset = 0;
    while (offset + 2 <= buf.length) {
      const opcode = buf[offset] & 0x0f;
      const masked = (buf[offset + 1] & 0x80) !== 0;
      let len = buf[offset + 1] & 0x7f;
      let pos = offset + 2;
      if (len === 126) {
        if (pos + 2 > buf.length) break;
        len = buf.readUInt16BE(pos);
        pos += 2;
      } else if (len === 127) {
        break;
      }
      const maskLen = masked ? 4 : 0;
      if (pos + maskLen + len > buf.length) break;
      const mask = masked ? buf.subarray(pos, pos + 4) : null;
      pos += maskLen;
      const data = Buffer.from(buf.subarray(pos, pos + len));
      if (mask) {
        for (let i = 0; i < data.length; i++) data[i] ^= mask[i % 4];
      }
      if (opcode === 0x1) {
        messages.push(data.toString('utf8'));
      }
      offset = pos + len;
    }
    return { messages, rest: buf.subarray(offset) };
  }

  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ service: 'openclaw-gateway-mock', protocol: 4 }));
  });

  const sockets = new Set<Duplex>();

  server.on('upgrade', (req, socket) => {
    sockets.add(socket);
    const key = req.headers['sec-websocket-key'];
    const accept = crypto
      .createHash('sha1')
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64');

    socket.write(
      [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${accept}`,
        '',
        '',
      ].join('\r\n'),
    );

    const sendJson = (obj: unknown) => socket.write(encodeTextFrame(JSON.stringify(obj)));

    // Step 1: Send connect.challenge immediately on open
    const challengeNonce = 'nonce_openclaw_test_123';
    sendJson({
      type: 'event',
      event: 'connect.challenge',
      payload: { nonce: challengeNonce, ts: Date.now() },
    });

    let buffer: Buffer = Buffer.alloc(0);
    let pendingAgentReqId: string | null = null;

    socket.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      const { messages, rest } = decodeClientFrames(buffer);
      buffer = rest;

      for (const raw of messages) {
        const frame = JSON.parse(raw);
        if (frame.type === 'req' && frame.method === 'connect') {
          const tok = frame.params?.auth?.token;
          const nonce = frame.params?.device?.nonce;
          if (tok === expectedToken && nonce === challengeNonce) {
            sendJson({
              type: 'res',
              id: frame.id,
              ok: true,
              payload: {
                type: 'hello-ok',
                protocol: 4,
                policy: { tickIntervalMs: 15000 },
              },
            });
          } else {
            sendJson({
              type: 'res',
              id: frame.id,
              ok: false,
              error: { code: 'UNAUTHORIZED', message: 'Invalid token or challenge nonce' },
            });
          }
        } else if (frame.type === 'req' && frame.method === 'agent') {
          pendingAgentReqId = frame.id;
          // Emit a thought and an approval request to test Cage's approval interception
          sendJson({
            type: 'event',
            event: 'agent',
            payload: { type: 'thought', text: 'Inspecting repository via OpenClaw...' },
          });
          sendJson({
            type: 'event',
            event: 'exec.approval',
            payload: {
              approvalId: 'oc_apr_99',
              tool: 'bash',
              summary: 'Run git status on OpenClaw host',
            },
          });
        } else if (frame.type === 'req' && frame.method === 'exec.approval.resolve') {
          lastApprovalDecision = Boolean(frame.params?.approved);
          sendJson({ type: 'res', id: frame.id, ok: true, payload: { recorded: true } });

          if (pendingAgentReqId) {
            sendJson({
              type: 'event',
              event: 'agent',
              payload: { type: 'tool_call', tool: 'bash', arguments: { cmd: 'git status' } },
            });
            sendJson({
              type: 'res',
              id: pendingAgentReqId,
              ok: true,
              payload: {
                output: lastApprovalDecision
                  ? 'OpenClaw executed approved command: working tree clean'
                  : 'OpenClaw aborted command after operator denial',
              },
            });
            pendingAgentReqId = null;
          }
        }
      }
    });

    socket.on('close', () => sockets.delete(socket));
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 18789;
      resolve({
        url: `ws://127.0.0.1:${port}`,
        getLastApprovalDecision: () => lastApprovalDecision,
        close: () =>
          new Promise<void>((res) => {
            for (const s of sockets) s.destroy();
            server.close(() => res());
          }),
      });
    });
  });
}

test('OpenClawClient completes v4 challenge handshake, intercepts approval, and streams agent output', async () => {
  const gw = await startMockOpenClawGateway('secret-gw-token');
  const client = new OpenClawClient();

  try {
    const state = await client.connect({
      wsUrl: gw.url,
      token: 'secret-gw-token',
      sessionKey: 'test-session',
      requireSendApproval: false,
    });
    assert.equal(state.status, 'connected');
    assert.equal(state.protocol, 4);

    const events: TimelineEvent[] = [];
    const output = await client.runPrompt({
      prompt: 'Check repo status',
      config: {
        wsUrl: gw.url,
        token: 'secret-gw-token',
        sessionKey: 'test-session',
        requireSendApproval: false,
      },
      onEvent: (e) => events.push(e),
      onApprovalRequired: async (pending) => {
        assert.equal(pending.toolName, 'bash');
        return true;
      },
    });

    assert.equal(gw.getLastApprovalDecision(), true);
    assert.match(output, /working tree clean/);
    assert.ok(events.some((e) => e.kind === 'approval_granted'));
    assert.ok(events.some((e) => e.kind === 'tool_call'));
    assert.ok(events.some((e) => e.kind === 'assistant'));
  } finally {
    client.disconnect();
    await gw.close();
  }
});

test('runAgentTurn dynamically injects connected MCP tools and enforces approval token', async () => {
  const policy: SecurityPolicy = {
    allowedDirs: ['/tmp/demo'],
    executionMode: 'local',
    permissions: {
      fs_read: 'auto_allow',
      fs_write: 'require_approval',
      fs_delete: 'require_approval',
      shell_exec: 'require_approval',
      web_fetch: 'auto_allow',
      vm_control: 'require_approval',
      mcp_tool: 'require_approval',
    },
  };

  let calledServer = '';
  let calledTool = '';
  let receivedToken = '';

  const bridge: HostBridge = {
    async getPolicy() {
      return policy;
    },
    async requestApproval(toolName, category, summary) {
      return {
        approvalId: 'apr_mcp_1',
        toolName,
        category,
        summary,
        argsHash: 'mcp_hash',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };
    },
    async approveRequest(approvalId) {
      return {
        approvalId,
        approvalToken: 'cage_grant_mcp_ok',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };
    },
    async denyRequest() {},
    async executeLocalTool() {
      return { ok: true, output: 'local', truncated: false };
    },
    async listMcpTools() {
      return [
        {
          serverId: 'github',
          serverName: 'GitHub MCP',
          name: 'list_issues',
          description: 'List repository issues',
          inputSchema: { type: 'object', properties: { repo: { type: 'string' } } },
        },
      ];
    },
    async callMcpTool(serverId, toolName, _args, token) {
      calledServer = serverId;
      calledTool = toolName;
      receivedToken = token ?? '';
      return { ok: true, output: 'Issue #1: Ship MCP support', truncated: false };
    },
    async proxyHttp() {
      // Simulate OpenAI-compatible LLM choosing the injected MCP tool on turn 1, then summarizing
      if (!calledTool) {
        return {
          status: 200,
          ok: true,
          body: JSON.stringify({
            choices: [
              {
                message: {
                  content: 'Checking issues via GitHub MCP.',
                  tool_calls: [
                    {
                      id: 'tc_mcp_1',
                      type: 'function',
                      function: {
                        name: 'mcp__github__list_issues',
                        arguments: JSON.stringify({ repo: 'Latencius/cage' }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
        };
      }
      return {
        status: 200,
        ok: true,
        body: JSON.stringify({
          choices: [{ message: { content: 'Found 1 open issue: Ship MCP support.' } }],
        }),
      };
    },
  };

  const events: TimelineEvent[] = [];
  await runAgentTurn({
    prompt: 'Check GitHub issues',
    history: [],
    llm: {
      providerName: 'MockLLM',
      baseUrl: 'http://127.0.0.1:9999/v1',
      apiKey: 'none',
      model: 'mock-model',
      demoMode: false,
    },
    mode: 'local',
    bridge,
    onEvent: (e) => events.push(e),
    onApprovalRequired: async (pending) => {
      assert.equal(pending.category, 'mcp_tool');
      assert.equal(pending.toolName, 'mcp__github__list_issues');
      return true;
    },
  });

  assert.equal(calledServer, 'github');
  assert.equal(calledTool, 'list_issues');
  assert.equal(receivedToken, 'cage_grant_mcp_ok');
  assert.ok(events.some((e) => e.kind === 'tool_result' && e.detail?.includes('Ship MCP support')));
});
