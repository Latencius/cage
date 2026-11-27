import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFallbackToolCalls } from './llm.ts';
import { runAgentTurn } from './engine.ts';
import type { HostBridge, SecurityPolicy, TimelineEvent } from './types.ts';

test('extractFallbackToolCalls parses JSON fenced blocks for small local LLMs', () => {
  const reply = 'ファイルを読みますね。\n```json\n{"tool":"read_file","arguments":{"path":"notes.md"}}\n```';
  const calls = extractFallbackToolCalls(reply, new Set(['read_file', 'write_file']));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].function.name, 'read_file');
  assert.deepEqual(JSON.parse(calls[0].function.arguments), { path: 'notes.md' });
});

test('runAgentTurn enforces human approval gate and stops when denied', async () => {
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
    },
  };

  let executed = false;
  const bridge: HostBridge = {
    async getPolicy() {
      return policy;
    },
    async requestApproval(toolName, category, summary) {
      return {
        approvalId: 'apr_1',
        toolName,
        category,
        summary,
        argsHash: 'abc',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };
    },
    async approveRequest(approvalId) {
      return { approvalId, approvalToken: 'tok_1', expiresAt: new Date(Date.now() + 60_000).toISOString() };
    },
    async denyRequest() {},
    async executeLocalTool() {
      executed = true;
      return { ok: true, output: 'deleted', truncated: false };
    },
  };

  const events: TimelineEvent[] = [];
  await runAgentTurn({
    prompt: 'temp-draft.txt を削除して',
    history: [],
    llm: { providerName: 'Demo', baseUrl: '', apiKey: '', model: 'demo', demoMode: true },
    mode: 'local',
    bridge,
    onEvent: (e) => events.push(e),
    onApprovalRequired: async () => false,
  });

  assert.equal(executed, false);
  assert.ok(events.some((e) => e.kind === 'approval_pending'));
  assert.ok(events.some((e) => e.kind === 'approval_denied'));
});

test('runAgentTurn passes one-time approval token when approved', async () => {
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
    },
  };

  let receivedToken: string | undefined;
  const bridge: HostBridge = {
    async getPolicy() {
      return policy;
    },
    async requestApproval(toolName, category, summary) {
      return {
        approvalId: 'apr_2',
        toolName,
        category,
        summary,
        argsHash: 'def',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };
    },
    async approveRequest(approvalId) {
      return { approvalId, approvalToken: 'cage_grant_test', expiresAt: new Date(Date.now() + 60_000).toISOString() };
    },
    async denyRequest() {},
    async executeLocalTool(_toolName, _args, token) {
      receivedToken = token;
      return { ok: true, output: 'wrote file', truncated: false };
    },
  };

  const events: TimelineEvent[] = [];
  await runAgentTurn({
    prompt: 'レポートを作成して',
    history: [],
    llm: { providerName: 'Demo', baseUrl: '', apiKey: '', model: 'demo', demoMode: true },
    mode: 'local',
    bridge,
    onEvent: (e) => events.push(e),
    onApprovalRequired: async () => true,
  });

  assert.equal(receivedToken, 'cage_grant_test');
  assert.ok(events.some((e) => e.kind === 'approval_granted'));
  assert.ok(events.some((e) => e.kind === 'tool_result' && e.ok));
});
