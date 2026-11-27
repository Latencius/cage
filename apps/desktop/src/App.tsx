import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IsolatedVmController,
  runAgentTurn,
  type AuditEntry,
  type ChatMessage,
  type ExecutionMode,
  type LlmConfig,
  type LocalLlmEndpoint,
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
  clearAuditLog,
  getAuditLog,
  getSecurityPolicy,
  pickAllowedFolder,
  scanLocalLlms,
  tauriHostBridge,
  updateSecurityPolicy,
} from './lib/tauri-bridge';

const STORAGE_LLM_KEY = 'cage.llm.config.v1';
const STORAGE_E2B_KEY = 'cage.e2b.apikey.v1';

const DEFAULT_LLM: LlmConfig = {
  providerName: 'Offline Demo',
  baseUrl: '',
  apiKey: '',
  model: 'cage-demo-simulator',
  demoMode: true,
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
  },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('mission');
  const [policy, setPolicy] = useState<SecurityPolicy>(DEFAULT_POLICY);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [endpoints, setEndpoints] = useState<LocalLlmEndpoint[]>([]);
  const [scanning, setScanning] = useState(false);

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

  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [running, setRunning] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<PendingApprovalView | null>(null);

  const approvalResolverRef = useRef<((approved: boolean) => void) | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const vmControllerRef = useRef(new IsolatedVmController());
  const [vmState, setVmState] = useState<VmSessionState>(() => vmControllerRef.current.getState());

  const refreshAudit = useCallback(async () => {
    const log = await getAuditLog();
    setAuditLog(log);
  }, []);

  const rescanLocalLlms = useCallback(async () => {
    setScanning(true);
    try {
      const found = await scanLocalLlms();
      setEndpoints(found);
      // Auto-select first online local LLM if user is still on initial demo mode
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
    rescanLocalLlms();
  }, [refreshAudit, rescanLocalLlms]);

  const handleChangeLlm = (next: LlmConfig) => {
    setLlm(next);
    try {
      localStorage.setItem(STORAGE_LLM_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
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

  const handleSendPrompt = async (prompt: string) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);

    try {
      const nextHistory = await runAgentTurn({
        prompt,
        history,
        llm,
        mode: policy.executionMode,
        bridge: tauriHostBridge,
        vm: vmControllerRef.current,
        signal: controller.signal,
        onEvent: (evt) => {
          setEvents((prev) => [...prev, evt]);
        },
        onApprovalRequired: (pending) =>
          new Promise<boolean>((resolve) => {
            approvalResolverRef.current = resolve;
            setPendingApproval(pending);
          }),
      });
      setHistory(nextHistory);
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
        llm={llm}
        allowedFolderCount={policy.allowedDirs.length}
        vmRunning={vmState.status === 'running'}
      />

      <main className="min-h-0 flex-1 overflow-hidden">
        {activeTab === 'mission' && (
          <MissionControl
            mode={policy.executionMode}
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
            onDone={() => setActiveTab('mission')}
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
          />
        )}
      </main>
    </div>
  );
}
