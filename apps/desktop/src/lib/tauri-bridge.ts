import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type {
  ApprovalChallenge,
  ApprovalGrant,
  AuditEntry,
  HostBridge,
  LocalLlmEndpoint,
  McpServerConfig,
  McpServerStatus,
  McpToolInfo,
  OpenClawProbeResult,
  SecurityPolicy,
  ToolCategory,
  ToolExecResult,
} from '@cage/agent-core';

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

const DEFAULT_POLICY: SecurityPolicy = {
  allowedDirs: [],
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

// In-memory browser fallback so UI can also be previewed via `vite` outside Tauri
let browserPolicy: SecurityPolicy = {
  ...DEFAULT_POLICY,
  allowedDirs: ['/Users/demo/CageWorkspace'],
};
let browserAudit: AuditEntry[] = [];
let browserMcpConfigs: McpServerConfig[] = [];
let browserMcpConnected = new Map<string, McpServerStatus>();

export async function getSecurityPolicy(): Promise<SecurityPolicy> {
  if (isTauriRuntime()) {
    const p = await invoke<SecurityPolicy>('get_security_policy');
    return {
      ...p,
      permissions: {
        ...DEFAULT_POLICY.permissions,
        ...p.permissions,
      },
    };
  }
  return structuredClone(browserPolicy);
}

export async function updateSecurityPolicy(policy: SecurityPolicy): Promise<SecurityPolicy> {
  if (isTauriRuntime()) {
    return invoke<SecurityPolicy>('update_security_policy', { policy });
  }
  browserPolicy = structuredClone(policy);
  return structuredClone(browserPolicy);
}

export async function getAuditLog(): Promise<AuditEntry[]> {
  if (isTauriRuntime()) {
    return invoke<AuditEntry[]>('get_audit_log');
  }
  return [...browserAudit];
}

export async function clearAuditLog(): Promise<void> {
  if (isTauriRuntime()) {
    await invoke('clear_audit_log');
    return;
  }
  browserAudit = [];
}

export async function scanLocalLlms(): Promise<LocalLlmEndpoint[]> {
  if (isTauriRuntime()) {
    return invoke<LocalLlmEndpoint[]>('scan_local_llms');
  }
  const probeBrowser = async (
    id: string,
    name: string,
    baseUrl: string,
    modelsUrl: string,
    isOllama: boolean,
  ): Promise<LocalLlmEndpoint> => {
    const start = performance.now();
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1200);
      const res = await fetch(modelsUrl, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error('offline');
      const json = (await res.json()) as {
        models?: Array<{ name?: string }>;
        data?: Array<{ id?: string }>;
      };
      const models = isOllama
        ? (json.models ?? []).map((m) => m.name).filter((x): x is string => Boolean(x))
        : (json.data ?? []).map((m) => m.id).filter((x): x is string => Boolean(x));
      return {
        id,
        name,
        baseUrl,
        online: true,
        models,
        latencyMs: Math.round(performance.now() - start),
      };
    } catch {
      return { id, name, baseUrl, online: false, models: [], latencyMs: null };
    }
  };
  return Promise.all([
    probeBrowser('ollama', 'Ollama', 'http://127.0.0.1:11434/v1', 'http://127.0.0.1:11434/api/tags', true),
    probeBrowser('lmstudio', 'LM Studio', 'http://127.0.0.1:1234/v1', 'http://127.0.0.1:1234/v1/models', false),
  ]);
}

export async function probeOpenClawGateway(wsUrl: string): Promise<OpenClawProbeResult> {
  if (isTauriRuntime()) {
    return invoke<OpenClawProbeResult>('probe_openclaw_gateway', { wsUrl });
  }
  const httpUrl = wsUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
  const start = performance.now();
  try {
    const res = await fetch(httpUrl);
    return {
      wsUrl,
      httpUrl,
      reachable: res.ok,
      latencyMs: Math.round(performance.now() - start),
      detail: `Gateway HTTP responded (${res.status})`,
    };
  } catch (err) {
    return {
      wsUrl,
      httpUrl,
      reachable: false,
      latencyMs: null,
      detail: err instanceof Error ? err.message : 'Unreachable',
    };
  }
}

export async function getMcpServers(): Promise<McpServerConfig[]> {
  if (isTauriRuntime()) {
    return invoke<McpServerConfig[]>('get_mcp_servers');
  }
  return structuredClone(browserMcpConfigs);
}

export async function saveMcpServers(servers: McpServerConfig[]): Promise<McpServerConfig[]> {
  if (isTauriRuntime()) {
    return invoke<McpServerConfig[]>('save_mcp_servers', { servers });
  }
  browserMcpConfigs = structuredClone(servers);
  return structuredClone(browserMcpConfigs);
}

export async function mcpConnectServer(config: McpServerConfig): Promise<McpServerStatus> {
  if (isTauriRuntime()) {
    return invoke<McpServerStatus>('mcp_connect_server', { config });
  }
  const status: McpServerStatus = {
    id: config.id,
    name: config.name,
    transport: config.transport,
    connected: true,
    serverInfo: 'Browser Preview MCP Mock v1.0',
    tools: [
      {
        serverId: config.id,
        serverName: config.name,
        name: 'sample_tool',
        description: 'Sample MCP tool (preview)',
        inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
      },
    ],
    error: null,
  };
  browserMcpConnected.set(config.id, status);
  return status;
}

export async function mcpDisconnectServer(serverId: string): Promise<void> {
  if (isTauriRuntime()) {
    await invoke('mcp_disconnect_server', { serverId });
    return;
  }
  browserMcpConnected.delete(serverId);
}

export async function mcpListStatuses(): Promise<McpServerStatus[]> {
  if (isTauriRuntime()) {
    return invoke<McpServerStatus[]>('mcp_list_statuses');
  }
  return browserMcpConfigs.map(
    (cfg) =>
      browserMcpConnected.get(cfg.id) ?? {
        id: cfg.id,
        name: cfg.name,
        transport: cfg.transport,
        connected: false,
        serverInfo: null,
        tools: [],
        error: null,
      },
  );
}

export async function mcpListTools(): Promise<McpToolInfo[]> {
  if (isTauriRuntime()) {
    return invoke<McpToolInfo[]>('mcp_list_tools');
  }
  return Array.from(browserMcpConnected.values()).flatMap((s) => s.tools);
}

export async function pickAllowedFolder(): Promise<string | null> {
  if (isTauriRuntime()) {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Select an allowed workspace folder for Cage',
    });
    return typeof selected === 'string' ? selected : null;
  }
  const entered = window.prompt(
    'Enter allowed folder path (Browser Preview):',
    '/Users/demo/Workspace',
  );
  return entered?.trim() || null;
}

export const tauriHostBridge: HostBridge = {
  getPolicy: getSecurityPolicy,

  async requestApproval(
    toolName: string,
    category: ToolCategory,
    summary: string,
    args: Record<string, unknown>,
  ): Promise<ApprovalChallenge> {
    if (isTauriRuntime()) {
      return invoke<ApprovalChallenge>('request_tool_approval', {
        toolName,
        category,
        summary,
        args,
      });
    }
    return {
      approvalId: `web_apr_${Date.now()}`,
      toolName,
      category,
      summary,
      argsHash: 'browser-preview-hash',
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    };
  },

  async approveRequest(approvalId: string): Promise<ApprovalGrant> {
    if (isTauriRuntime()) {
      return invoke<ApprovalGrant>('approve_tool_request', { approvalId });
    }
    return {
      approvalId,
      approvalToken: `web_grant_${Date.now()}`,
      expiresAt: new Date(Date.now() + 120_000).toISOString(),
    };
  },

  async denyRequest(approvalId: string): Promise<void> {
    if (isTauriRuntime()) {
      await invoke('deny_tool_request', { approvalId });
    }
  },

  async executeLocalTool(
    toolName: string,
    args: Record<string, unknown>,
    approvalToken?: string,
  ): Promise<ToolExecResult> {
    if (isTauriRuntime()) {
      return invoke<ToolExecResult>('execute_local_tool', {
        toolName,
        args,
        approvalToken: approvalToken ?? null,
      });
    }
    browserAudit.push({
      id: `aud_${Date.now()}`,
      timestamp: new Date().toISOString(),
      toolName,
      category: toolName === 'run_shell' ? 'shell_exec' : 'fs_write',
      decision: approvalToken ? 'approved_and_executed' : 'auto_allowed',
      summary: `[Preview] Executed ${toolName} with ${JSON.stringify(args)}`,
      ok: true,
    });
    return {
      ok: true,
      output: `[Browser Preview] Simulated ${toolName}(${JSON.stringify(args)}) inside ${browserPolicy.allowedDirs[0] ?? '.'}`,
      truncated: false,
    };
  },

  listMcpTools: mcpListTools,

  async callMcpTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
    approvalToken?: string,
  ): Promise<ToolExecResult> {
    if (isTauriRuntime()) {
      return invoke<ToolExecResult>('mcp_call_tool', {
        serverId,
        toolName,
        args,
        approvalToken: approvalToken ?? null,
      });
    }
    return {
      ok: true,
      output: `[Browser Preview] Simulated MCP ${serverId}.${toolName}(${JSON.stringify(args)})`,
      truncated: false,
    };
  },

  async proxyHttp(req) {
    if (isTauriRuntime()) {
      return invoke<{ status: number; ok: boolean; body: string }>('proxy_http', { req });
    }
    const res = await fetch(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body,
    });
    return { status: res.status, ok: res.ok, body: await res.text() };
  },
};
