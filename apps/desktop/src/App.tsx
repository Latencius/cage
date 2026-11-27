import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IsolatedVmController,
  OpenClawClient,
  runAgentTurn,
  type AgentRuntime,
  type AuditEntry,
  type ChatMessage,
  type ExecutionMode,
  type LlmConfig,
  type LocalLlmEndpoint,
  type McpServerConfig,
  type McpServerStatus,
  type OpenClawConfig,
  type OpenClawConnectionState,
  type OpenClawProbeResult,
  type PendingApprovalView,
  type PermissionLevel,
  type SecurityPolicy,
  type TimelineEvent,
  type ToolCategory,
  type VmSessionState,
} from '@cage/agent-core';
import { GlassHeader, type ActiveTab } from './components/GlassHeader';
import { MissionControl } from './components/MissionControl';
import { SafetyPanel } from './components/SafetyPanel';
import { SetupWizard } from './components/SetupWizard';
import {
  DESKTOP_MESSAGES,
  getInitialLocale,
  persistLocale,
  type Locale,
} from './i18n';
import {
  clearAuditLog,
  getAuditLog,
  getMcpServers,
  getSecurityPolicy,
  mcpConnectServer,
  mcpDisconnectServer,
  mcpListStatuses,
  pickAllowedFolder,
  probeOpenClawGateway,
  saveMcpServers,
  scanLocalLlms,
  tauriHostBridge,
  updateSecurityPolicy,
} from './lib/tauri-bridge';

const STORAGE_LLM_KEY = 'cage.llm.config.v1';
const STORAGE_E2B_KEY = 'cage.e2b.apikey.v1';
const STORAGE_OPENCLAW_KEY = 'cage.openclaw.config.v1';

const DEFAULT_LLM: LlmConfig = {
  providerName: 'Offline Demo',
  baseUrl: '',
  apiKey: '',
  model: 'cage-demo-simulator',
  demoMode: true,
};

const DEFAULT_OPENCLAW: OpenClawConfig = {
  wsUrl: 'ws://127.0.0.1:18789',
  token: '',
  sessionKey: 'cage-main',
  requireSendApproval: true,
};

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

export default function App() {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const [activeTab, setActiveTab] = useState<ActiveTab>('mission');
  const [runtime, setRuntime] = useState<AgentRuntime>('builtin');
  const [policy, setPolicy] = useState<SecurityPolicy>(DEFAULT_POLICY);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [endpoints, setEndpoints] = useState<LocalLlmEndpoint[]>([]);
  const [scanning, setScanning] = useState(false);

  const t = DESKTOP_MESSAGES[locale];

  useEffect(() => {
    persistLocale(locale);
  }, [locale]);

  const [llm, setLlm] = useState<LlmConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LLM_KEY);
      return saved ? (JSON.parse(saved) as LlmConfig) : DEFAULT_LLM;
    } catch {
      return DEFAULT_LLM;
    }
  });

  const [e2bApiKey, setE2bApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_E2B_KEY) ?? '';
    } catch {
      return '';
    }
  });

  const [openClawConfig, setOpenClawConfig] = useState<OpenClawConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_OPENCLAW_KEY);
      return saved ? { ...DEFAULT_OPENCLAW, ...(JSON.parse(saved) as OpenClawConfig) } : DEFAULT_OPENCLAW;
    } catch {
      return DEFAULT_OPENCLAW;
    }
  });
  const openClawClientRef = useRef(new OpenClawClient());
  const [openClawState, setOpenClawState] = useState<OpenClawConnectionState>(() =>
    openClawClientRef.current.getState(),
  );
  const [openClawProbe, setOpenClawProbe] = useState<OpenClawProbeResult | null>(null);

  const [mcpServers, setMcpServers] = useState<McpServerConfig[]>([]);
  const [mcpStatuses, setMcpStatuses] = useState<McpServerStatus[]>([]);
  const [mcpBusyId, setMcpBusyId] = useState<string | null>(null);
  const [mcpError, setMcpError] = useState<string | null>(null);

  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [running, setRunning] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<PendingApprovalView | null>(null);

  const approvalResolverRef = useRef<((approved: boolean) => void) | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const vmControllerRef = useRef(new IsolatedVmController());
  const [vmState, setVmState] = useState<VmSessionState>(() => vmControllerRef.current.getState());

  const mcpToolCount = mcpStatuses.reduce(
    (sum, s) => sum + (s.connected ? s.tools.length : 0),
    0,
  );

  const refreshAudit = useCallback(async () => {
    const log = await getAuditLog();
    setAuditLog(log);
  }, []);

  const refreshMcp = useCallback(async () => {
    const [cfgs, statuses] = await Promise.all([getMcpServers(), mcpListStatuses()]);
    setMcpServers(cfgs);
    setMcpStatuses(statuses);
  }, []);

  const rescanLocalLlms = useCallback(async () => {
    setScanning(true);
    try {
      const found = await scanLocalLlms();
      setEndpoints(found);
      const online = found.find((ep) => ep.online);
      if (online && llm.demoMode) {
        const next: LlmConfig = {
          providerName: online.name,
          baseUrl: online.baseUrl,
          apiKey: 'local-no-key',
          model: online.models[0] ?? 'llama3.2',
          demoMode: false,
        };
        setLlm(next);
      }
    } finally {
      setScanning(false);
    }
  }, [llm.demoMode]);

  useEffect(() => {
    getSecurityPolicy().then(setPolicy);
    refreshAudit();
    refreshMcp();
    rescanLocalLlms();
  }, [refreshAudit, refreshMcp, rescanLocalLlms]);

  const handleChangeLlm = (next: LlmConfig) => {
    setLlm(next);
    try {
      localStorage.setItem(STORAGE_LLM_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const handleChangeE2bKey = (key: string) => {
    setE2bApiKey(key);
    try {
      localStorage.setItem(STORAGE_E2B_KEY, key);
    } catch {
      // ignore
    }
  };

  const handleChangeOpenClawConfig = (cfg: OpenClawConfig) => {
    setOpenClawConfig(cfg);
    try {
      localStorage.setItem(STORAGE_OPENCLAW_KEY, JSON.stringify(cfg));
    } catch {
      // ignore
    }
  };

  const handleProbeOpenClaw = async () => {
    const res = await probeOpenClawGateway(openClawConfig.wsUrl);
    setOpenClawProbe(res);
  };

  const handleConnectOpenClaw = async () => {
    setOpenClawState({ status: 'connecting', protocol: null, serverNote: null });
    const next = await openClawClientRef.current.connect(openClawConfig);
    setOpenClawState(next);
  };

  const handleDisconnectOpenClaw = () => {
    openClawClientRef.current.disconnect();
    setOpenClawState(openClawClientRef.current.getState());
  };

  const handleAddMcpServer = async (cfg: McpServerConfig) => {
    setMcpError(null);
    const next = [...mcpServers, cfg];
    const saved = await saveMcpServers(next);
    setMcpServers(saved);
    setMcpStatuses(await mcpListStatuses());
  };

  const handleRemoveMcpServer = async (id: string) => {
    setMcpError(null);
    await mcpDisconnectServer(id);
    const next = mcpServers.filter((s) => s.id !== id);
    const saved = await saveMcpServers(next);
    setMcpServers(saved);
    setMcpStatuses(await mcpListStatuses());
  };

  const handleConnectMcpServer = async (cfg: McpServerConfig) => {
    setMcpBusyId(cfg.id);
    setMcpError(null);
    try {
      await mcpConnectServer(cfg);
      setMcpStatuses(await mcpListStatuses());
    } catch (err) {
      setMcpError(err instanceof Error ? err.message : String(err));
    } finally {
      setMcpBusyId(null);
    }
  };

  const handleDisconnectMcpServer = async (id: string) => {
    setMcpBusyId(id);
    setMcpError(null);
    try {
      await mcpDisconnectServer(id);
      setMcpStatuses(await mcpListStatuses());
    } finally {
      setMcpBusyId(null);
    }
  };

  const persistPolicy = async (next: SecurityPolicy) => {
    const saved = await updateSecurityPolicy(next);
    setPolicy(saved);
  };

  const handleChangeMode = async (mode: ExecutionMode) => {
    await persistPolicy({ ...policy, executionMode: mode });
  };

  const handleAddFolder = async () => {
    const dir = await pickAllowedFolder();
    if (!dir) return;
    if (policy.allowedDirs.includes(dir)) return;
    await persistPolicy({ ...policy, allowedDirs: [...policy.allowedDirs, dir] });
  };

  const handleRemoveFolder = async (dir: string) => {
    await persistPolicy({
      ...policy,
      allowedDirs: policy.allowedDirs.filter((d) => d !== dir),
    });
  };

  const handleChangePermission = async (category: ToolCategory, level: PermissionLevel) => {
    await persistPolicy({
      ...policy,
      permissions: { ...policy.permissions, [category]: level },
    });
  };

  const requestUserApproval = (pending: PendingApprovalView) =>
    new Promise<boolean>((resolve) => {
      approvalResolverRef.current = resolve;
      setPendingApproval(pending);
    });

  const handleSendPrompt = async (prompt: string) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);

    try {
      if (runtime === 'openclaw') {
        await openClawClientRef.current.runPrompt({
          prompt,
          config: openClawConfig,
          onEvent: (evt) => setEvents((prev) => [...prev, evt]),
          onApprovalRequired: requestUserApproval,
        });
        setOpenClawState(openClawClientRef.current.getState());
      } else {
        const nextHistory = await runAgentTurn({
          prompt,
          history,
          llm,
          mode: policy.executionMode,
          bridge: tauriHostBridge,
          vm: vmControllerRef.current,
          signal: controller.signal,
          onEvent: (evt) => setEvents((prev) => [...prev, evt]),
          onApprovalRequired: requestUserApproval,
        });
        setHistory(nextHistory);
      }
    } catch (err) {
      setEvents((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          timestamp: new Date().toISOString(),
          kind: 'error',
          title: err instanceof Error ? err.message : String(err),
        },
      ]);
      if (runtime === 'openclaw') {
        setOpenClawState(openClawClientRef.current.getState());
      }
    } finally {
      setPendingApproval(null);
      approvalResolverRef.current = null;
      abortRef.current = null;
      setRunning(false);
      refreshAudit();
    }
  };

  const resolveApproval = (approved: boolean) => {
    const resolver = approvalResolverRef.current;
    approvalResolverRef.current = null;
    setPendingApproval(null);
    resolver?.(approved);
  };

  const handleStopRun = () => {
    abortRef.current?.abort();
    resolveApproval(false);
  };

  const handleStartVm = async () => {
    setVmState({ ...vmControllerRef.current.getState(), status: 'starting', error: undefined });
    const next = await vmControllerRef.current.start(e2bApiKey);
    setVmState(next);
  };

  const handleStopVm = async () => {
    const next = await vmControllerRef.current.stop();
    setVmState(next);
  };

  const handleToggleTakeover = () => {
    const next = vmControllerRef.current.setTakeover(!vmState.takeover);
    setVmState(next);
  };

  return (
    <div
      className={`cage-ambient flex h-screen w-screen flex-col ${
        policy.executionMode === 'isolated_vm' ? 'mode-vm' : ''
      }`}
    >
      <GlassHeader
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        mode={policy.executionMode}
        onChangeMode={handleChangeMode}
        runtime={runtime}
        mcpToolCount={mcpToolCount}
        llm={llm}
        allowedFolderCount={policy.allowedDirs.length}
        vmRunning={vmState.status === 'running'}
        locale={locale}
        onChangeLocale={setLocale}
        t={t.header}
      />

      <main className="min-h-0 flex-1 overflow-hidden">
        {activeTab === 'mission' && (
          <MissionControl
            mode={policy.executionMode}
            runtime={runtime}
            onChangeRuntime={setRuntime}
            mcpToolCount={mcpToolCount}
            openClawConnected={openClawState.status === 'connected'}
            events={events}
            running={running}
            pendingApproval={pendingApproval}
            allowedDirs={policy.allowedDirs}
            vmState={vmState}
            hasE2bKey={Boolean(e2bApiKey.trim())}
            onSendPrompt={handleSendPrompt}
            onStopRun={handleStopRun}
            onClearTimeline={() => {
              setEvents([]);
              setHistory([]);
            }}
            onApprove={() => resolveApproval(true)}
            onDeny={() => resolveApproval(false)}
            onStartVm={handleStartVm}
            onStopVm={handleStopVm}
            onToggleTakeover={handleToggleTakeover}
            onOpenSetup={() => setActiveTab('setup')}
            onOpenSafety={() => setActiveTab('safety')}
            t={t}
          />
        )}

        {activeTab === 'setup' && (
          <SetupWizard
            endpoints={endpoints}
            scanning={scanning}
            onRescan={rescanLocalLlms}
            llm={llm}
            onChangeLlm={handleChangeLlm}
            e2bApiKey={e2bApiKey}
            onChangeE2bApiKey={handleChangeE2bKey}
            runtime={runtime}
            onChangeRuntime={setRuntime}
            openClawConfig={openClawConfig}
            onChangeOpenClawConfig={handleChangeOpenClawConfig}
            openClawState={openClawState}
            openClawProbe={openClawProbe}
            onProbeOpenClaw={handleProbeOpenClaw}
            onConnectOpenClaw={handleConnectOpenClaw}
            onDisconnectOpenClaw={handleDisconnectOpenClaw}
            mcpServers={mcpServers}
            mcpStatuses={mcpStatuses}
            mcpBusyId={mcpBusyId}
            mcpError={mcpError}
            onAddMcpServer={handleAddMcpServer}
            onRemoveMcpServer={handleRemoveMcpServer}
            onConnectMcpServer={handleConnectMcpServer}
            onDisconnectMcpServer={handleDisconnectMcpServer}
            onDone={() => setActiveTab('mission')}
            t={t.setup}
          />
        )}

        {activeTab === 'safety' && (
          <SafetyPanel
            policy={policy}
            auditLog={auditLog}
            onAddFolder={handleAddFolder}
            onRemoveFolder={handleRemoveFolder}
            onChangePermission={handleChangePermission}
            onClearAudit={async () => {
              await clearAuditLog();
              setAuditLog([]);
            }}
            t={t.safety}
          />
        )}
      </main>
    </div>
  );
}
