export type PermissionLevel = 'auto_allow' | 'require_approval' | 'deny';

export type ToolCategory =
  | 'fs_read'
  | 'fs_write'
  | 'fs_delete'
  | 'shell_exec'
  | 'web_fetch'
  | 'vm_control';

export type ExecutionMode = 'local' | 'isolated_vm';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface SecurityPolicy {
  allowedDirs: string[];
  permissions: Record<ToolCategory, PermissionLevel>;
  executionMode: ExecutionMode;
}

export interface LocalLlmEndpoint {
  id: string;
  name: string;
  baseUrl: string;
  online: boolean;
  models: string[];
  latencyMs: number | null;
}

export interface LlmConfig {
  providerName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  demoMode?: boolean;
}

export interface ApprovalChallenge {
  approvalId: string;
  toolName: string;
  category: ToolCategory;
  summary: string;
  argsHash: string;
  expiresAt: string;
}

export interface ApprovalGrant {
  approvalId: string;
  approvalToken: string;
  expiresAt: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  toolName: string;
  category: ToolCategory;
  decision: string;
  summary: string;
  ok: boolean;
}

export interface ToolExecResult {
  ok: boolean;
  output: string;
  truncated: boolean;
  screenshotBase64?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: ParsedToolCall[];
}

export interface ParsedToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  kind:
    | 'user'
    | 'thought'
    | 'tool_call'
    | 'approval_pending'
    | 'approval_granted'
    | 'approval_denied'
    | 'tool_result'
    | 'assistant'
    | 'error'
    | 'mode_switch';
  title: string;
  detail?: string;
  toolName?: string;
  category?: ToolCategory;
  risk?: RiskLevel;
  args?: Record<string, unknown>;
  ok?: boolean;
  screenshotBase64?: string;
}

export interface PendingApprovalView {
  challenge: ApprovalChallenge;
  toolName: string;
  category: ToolCategory;
  risk: RiskLevel;
  args: Record<string, unknown>;
  summary: string;
}

export interface VmSessionState {
  status: 'idle' | 'starting' | 'running' | 'error';
  sandboxId: string | null;
  streamUrl: string | null;
  interactiveStreamUrl: string | null;
  takeover: boolean;
  error?: string;
}

export type HttpProxyFn = (req: {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}) => Promise<{ status: number; ok: boolean; body: string }>;

export interface HostBridge {
  getPolicy(): Promise<SecurityPolicy>;
  requestApproval(
    toolName: string,
    category: ToolCategory,
    summary: string,
    args: Record<string, unknown>,
  ): Promise<ApprovalChallenge>;
  approveRequest(approvalId: string): Promise<ApprovalGrant>;
  denyRequest(approvalId: string): Promise<void>;
  executeLocalTool(
    toolName: string,
    args: Record<string, unknown>,
    approvalToken?: string,
  ): Promise<ToolExecResult>;
  proxyHttp?: HttpProxyFn;
}
