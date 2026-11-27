import { useState } from 'react';
import type {
  AgentRuntime,
  LlmConfig,
  LocalLlmEndpoint,
  McpServerConfig,
  McpServerStatus,
  McpTransport,
  OpenClawConfig,
  OpenClawConnectionState,
  OpenClawProbeResult,
} from '@cage/agent-core';
import {
  CheckCircle2,
  Cloud,
  Cpu,
  KeyRound,
  Link2,
  Plug,
  PlugZap,
  Plus,
  Radio,
  RefreshCw,
  Server,
  Sparkles,
  Trash2,
  Wifi,
  WifiOff,
  Wrench,
} from 'lucide-react';
import type { DesktopMessages } from '../i18n';

interface SetupWizardProps {
  endpoints: LocalLlmEndpoint[];
  scanning: boolean;
  onRescan: () => void;
  llm: LlmConfig;
  onChangeLlm: (config: LlmConfig) => void;
  e2bApiKey: string;
  onChangeE2bApiKey: (key: string) => void;
  runtime: AgentRuntime;
  onChangeRuntime: (rt: AgentRuntime) => void;
  openClawConfig: OpenClawConfig;
  onChangeOpenClawConfig: (cfg: OpenClawConfig) => void;
  openClawState: OpenClawConnectionState;
  openClawProbe: OpenClawProbeResult | null;
  onProbeOpenClaw: () => void;
  onConnectOpenClaw: () => void;
  onDisconnectOpenClaw: () => void;
  mcpServers: McpServerConfig[];
  mcpStatuses: McpServerStatus[];
  mcpBusyId: string | null;
  mcpError: string | null;
  onAddMcpServer: (cfg: McpServerConfig) => void;
  onRemoveMcpServer: (id: string) => void;
  onConnectMcpServer: (cfg: McpServerConfig) => void;
  onDisconnectMcpServer: (id: string) => void;
  onDone: () => void;
  t: DesktopMessages['setup'];
}

const PYTHON_SELF_TEST_MCP = `import sys, json, datetime
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    m = json.loads(line)
    mid, meth = m.get("id"), m.get("method")
    if meth == "initialize":
        print(json.dumps({"jsonrpc":"2.0","id":mid,"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"cage-local-mcp","version":"0.2.0"}}}), flush=True)
    elif meth == "tools/list":
        print(json.dumps({"jsonrpc":"2.0","id":mid,"result":{"tools":[{"name":"current_time","description":"Return current ISO timestamp","inputSchema":{"type":"object","properties":{}}},{"name":"echo_note","description":"Echo and tag a note via MCP","inputSchema":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"]}}]}}), flush=True)
    elif meth == "tools/call":
        p = m.get("params", {})
        name, args = p.get("name"), p.get("arguments", {})
        out = datetime.datetime.now().isoformat() if name == "current_time" else f"[MCP Echo] {args.get('text','')}"
        print(json.dumps({"jsonrpc":"2.0","id":mid,"result":{"content":[{"type":"text","text":out}],"isError":False}}), flush=True)
`;

export function SetupWizard({
  endpoints,
  scanning,
  onRescan,
  llm,
  onChangeLlm,
  e2bApiKey,
  onChangeE2bApiKey,
  runtime,
  onChangeRuntime,
  openClawConfig,
  onChangeOpenClawConfig,
  openClawState,
  openClawProbe,
  onProbeOpenClaw,
  onConnectOpenClaw,
  onDisconnectOpenClaw,
  mcpServers,
  mcpStatuses,
  mcpBusyId,
  mcpError,
  onAddMcpServer,
  onRemoveMcpServer,
  onConnectMcpServer,
  onDisconnectMcpServer,
  onDone,
  t,
}: SetupWizardProps) {
  const [customUrl, setCustomUrl] = useState(llm.baseUrl || 'https://api.openai.com/v1');
  const [customKey, setCustomKey] = useState(llm.apiKey || '');
  const [customModel, setCustomModel] = useState(llm.model || 'gpt-4o-mini');

  const [mcpName, setMcpName] = useState('');
  const [mcpTransport, setMcpTransport] = useState<McpTransport>('stdio');
  const [mcpCommand, setMcpCommand] = useState('npx');
  const [mcpArgs, setMcpArgs] = useState('-y @modelcontextprotocol/server-memory');
  const [mcpUrl, setMcpUrl] = useState('http://127.0.0.1:3001/mcp');

  const connectLocal = (ep: LocalLlmEndpoint, model?: string) => {
    onChangeLlm({
      providerName: ep.name,
      baseUrl: ep.baseUrl,
      apiKey: 'local-no-key',
      model: model ?? ep.models[0] ?? 'llama3.2',
      demoMode: false,
    });
  };

  const applyCustom = () => {
    onChangeLlm({
      providerName: 'OpenAI-Compatible',
      baseUrl: customUrl.trim(),
      apiKey: customKey.trim(),
      model: customModel.trim() || 'gpt-4o-mini',
      demoMode: false,
    });
  };

  const handleCreateMcp = (e: React.FormEvent) => {
    e.preventDefault();
    const name = mcpName.trim() || (mcpTransport === 'stdio' ? mcpCommand.trim() : 'HTTP MCP');
    if (!name) return;
    const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 18)}-${Date.now().toString(36).slice(-4)}`;
    const cfg: McpServerConfig =
      mcpTransport === 'stdio'
        ? {
            id,
            name,
            transport: 'stdio',
            command: mcpCommand.trim(),
            args: mcpArgs.trim() ? mcpArgs.trim().split(/\s+/) : [],
            enabled: true,
          }
        : {
            id,
            name,
            transport: 'http',
            url: mcpUrl.trim(),
            enabled: true,
          };
    onAddMcpServer(cfg);
    setMcpName('');
  };

  const addPreset = (preset: 'selftest' | 'memory' | 'fetch') => {
    if (preset === 'selftest') {
      onAddMcpServer({
        id: `local-py-${Date.now().toString(36).slice(-4)}`,
        name: 'Local Python Test MCP',
        transport: 'stdio',
        command: 'python3',
        args: ['-u', '-c', PYTHON_SELF_TEST_MCP],
        enabled: true,
      });
    } else if (preset === 'memory') {
      onAddMcpServer({
        id: `memory-${Date.now().toString(36).slice(-4)}`,
        name: 'MCP Memory (npx)',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory'],
        enabled: true,
      });
    } else {
      onAddMcpServer({
        id: `fetch-${Date.now().toString(36).slice(-4)}`,
        name: 'MCP Fetch (uvx)',
        transport: 'stdio',
        command: 'uvx',
        args: ['mcp-server-fetch'],
        enabled: true,
      });
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-5 overflow-y-auto px-4 py-5">
      {/* Top Banner */}
      <div className="glass-panel flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2.5 py-0.5 text-[11px] font-medium text-cyan-200">
            <Wifi className="h-3 w-3" />
            {t.badge}
          </span>
          <h2 className="mt-2 text-lg font-semibold text-white">{t.title}</h2>
          <p className="mt-0.5 text-xs text-slate-300/80">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRescan}
            disabled={scanning}
            className="glass-pill flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium text-cyan-100 transition hover:bg-white/15 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? t.scanning : t.rescan}
          </button>
          <button
            onClick={onDone}
            className="rounded-xl bg-gradient-to-r from-cyan-400/85 to-sky-500/85 px-4 py-2 text-xs font-semibold text-slate-950 shadow-[0_6px_24px_rgba(56,189,248,0.35)] transition hover:brightness-110"
          >
            {t.toMission}
          </button>
        </div>
      </div>

      {/* Auto-detected Local LLMs */}
      <section className="glass-panel rounded-2xl p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Server className="h-4 w-4 text-cyan-300" />
            {t.localSectionTitle}
          </h3>
          <button
            onClick={() =>
              onChangeLlm({
                providerName: 'Offline Demo',
                baseUrl: '',
                apiKey: '',
                model: 'cage-demo-simulator',
                demoMode: true,
              })
            }
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
              llm.demoMode
                ? 'bg-emerald-400/25 text-emerald-100 ring-1 ring-emerald-300/40'
                : 'bg-white/8 text-slate-300 hover:bg-white/15'
            }`}
          >
            <Sparkles className="mr-1 inline h-3 w-3" />
            {t.useDemo}
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {endpoints.map((ep) => {
            const isSelected = !llm.demoMode && llm.baseUrl === ep.baseUrl;
            return (
              <div
                key={ep.id}
                className={`glass-card flex flex-col justify-between rounded-xl p-4 transition ${
                  isSelected ? 'ring-1 ring-cyan-300/60' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          ep.online
                            ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]'
                            : 'bg-slate-500/70'
                        }`}
                      />
                      <span className="text-sm font-semibold text-white">{ep.name}</span>
                      {ep.latencyMs !== null && (
                        <span className="text-[11px] text-emerald-300/90">{ep.latencyMs}ms</span>
                      )}
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-slate-400">{ep.baseUrl}</p>
                  </div>

                  {ep.online ? (
                    <button
                      onClick={() => connectLocal(ep)}
                      className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        isSelected
                          ? 'bg-emerald-400/25 text-emerald-100 ring-1 ring-emerald-300/40'
                          : 'bg-white/15 text-white hover:bg-white/25'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" /> {t.connected}
                        </>
                      ) : (
                        t.connect
                      )}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 text-[11px] text-slate-400">
                      <WifiOff className="h-3 w-3" /> {t.offline}
                    </span>
                  )}
                </div>

                {ep.online && ep.models.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {ep.models.slice(0, 6).map((m) => (
                      <button
                        key={m}
                        onClick={() => connectLocal(ep, m)}
                        className={`rounded-md px-2 py-0.5 font-mono text-[11px] transition ${
                          isSelected && llm.model === m
                            ? 'bg-cyan-400/30 text-cyan-100 ring-1 ring-cyan-300/50'
                            : 'bg-white/8 text-slate-300 hover:bg-white/15'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* OpenClaw Gateway + MCP Servers */}
      <section className="glass-panel rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Radio className="h-4 w-4 text-amber-300" />
              {t.openclawTitle}
            </h3>
            <p className="mt-1 text-xs text-slate-300/80">{t.openclawDesc}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onProbeOpenClaw}
              className="glass-pill rounded-xl px-3 py-1.5 text-xs font-medium text-amber-100 transition hover:bg-white/15"
            >
              {t.openclawProbe}
            </button>
            <button
              onClick={() => onChangeRuntime(runtime === 'openclaw' ? 'builtin' : 'openclaw')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                runtime === 'openclaw'
                  ? 'bg-amber-400/30 text-amber-100 ring-1 ring-amber-300/50'
                  : 'bg-white/10 text-slate-200 hover:bg-white/20'
              }`}
            >
              {runtime === 'openclaw' ? t.openclawActiveRuntime : t.openclawUseRuntime}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-[11px] text-slate-300">Gateway WebSocket URL</label>
            <input
              value={openClawConfig.wsUrl}
              onChange={(e) =>
                onChangeOpenClawConfig({ ...openClawConfig, wsUrl: e.target.value })
              }
              placeholder="ws://127.0.0.1:18789"
              className="glass-input w-full rounded-xl px-3 py-2 font-mono text-xs text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-300">Gateway Auth Token</label>
            <input
              type="password"
              value={openClawConfig.token}
              onChange={(e) =>
                onChangeOpenClawConfig({ ...openClawConfig, token: e.target.value })
              }
              placeholder="openclaw_token_..."
              className="glass-input w-full rounded-xl px-3 py-2 font-mono text-xs text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-300">Session Key</label>
            <input
              value={openClawConfig.sessionKey}
              onChange={(e) =>
                onChangeOpenClawConfig({ ...openClawConfig, sessionKey: e.target.value })
              }
              placeholder="cage-main"
              className="glass-input w-full rounded-xl px-3 py-2 font-mono text-xs text-white"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-200">
            <input
              type="checkbox"
              checked={openClawConfig.requireSendApproval}
              onChange={(e) =>
                onChangeOpenClawConfig({
                  ...openClawConfig,
                  requireSendApproval: e.target.checked,
                })
              }
              className="h-3.5 w-3.5 accent-amber-400"
            />
            {t.openclawRequireApproval}
          </label>

          <div className="flex items-center gap-2">
            {openClawProbe && (
              <span
                className={`rounded-lg px-2.5 py-1 text-[11px] ${
                  openClawProbe.reachable
                    ? 'bg-emerald-400/15 text-emerald-200'
                    : 'bg-white/5 text-slate-400'
                }`}
              >
                {openClawProbe.reachable
                  ? `Online (${openClawProbe.latencyMs ?? 0}ms)`
                  : openClawProbe.detail.slice(0, 60)}
              </span>
            )}
            {openClawState.status === 'connected' ? (
              <button
                onClick={onDisconnectOpenClaw}
                className="flex items-center gap-1.5 rounded-xl bg-rose-500/25 px-3.5 py-1.5 text-xs font-semibold text-rose-100 ring-1 ring-rose-400/40 transition hover:bg-rose-500/40"
              >
                <Plug className="h-3.5 w-3.5" />
                {t.openclawDisconnect} ({openClawState.serverNote})
              </button>
            ) : (
              <button
                onClick={onConnectOpenClaw}
                disabled={openClawState.status === 'connecting'}
                className="flex items-center gap-1.5 rounded-xl border border-amber-300/40 bg-amber-400/20 px-4 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/30 disabled:opacity-50"
              >
                <PlugZap className="h-3.5 w-3.5" />
                {openClawState.status === 'connecting' ? '...' : t.openclawConnect}
              </button>
            )}
          </div>
        </div>
        {openClawState.error && (
          <p className="mt-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
            {openClawState.error}
          </p>
        )}
      </section>

      {/* MCP Servers Section */}
      <section className="glass-panel rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Wrench className="h-4 w-4 text-emerald-300" />
              {t.mcpTitle}
            </h3>
            <p className="mt-1 text-xs text-slate-300/80">{t.mcpDesc}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-slate-400">{t.mcpPresetsLabel}</span>
            <button
              onClick={() => addPreset('selftest')}
              className="rounded-lg border border-emerald-300/30 bg-emerald-400/15 px-2.5 py-1 font-medium text-emerald-100 transition hover:bg-emerald-400/25"
            >
              + Python Test MCP
            </button>
            <button
              onClick={() => addPreset('memory')}
              className="rounded-lg border border-white/15 bg-white/8 px-2.5 py-1 text-slate-200 transition hover:bg-white/15"
            >
              + Memory (npx)
            </button>
            <button
              onClick={() => addPreset('fetch')}
              className="rounded-lg border border-white/15 bg-white/8 px-2.5 py-1 text-slate-200 transition hover:bg-white/15"
            >
              + Fetch (uvx)
            </button>
          </div>
        </div>

        {/* Add Custom MCP Server Form */}
        <form onSubmit={handleCreateMcp} className="mt-4 grid gap-2.5 md:grid-cols-12">
          <input
            value={mcpName}
            onChange={(e) => setMcpName(e.target.value)}
            placeholder="Server name (e.g. GitHub MCP)"
            className="glass-input rounded-xl px-3 py-2 text-xs text-white md:col-span-3"
          />
          <select
            value={mcpTransport}
            onChange={(e) => setMcpTransport(e.target.value as McpTransport)}
            className="glass-input rounded-xl px-2.5 py-2 text-xs text-white md:col-span-2"
          >
            <option value="stdio">stdio</option>
            <option value="http">HTTP</option>
          </select>
          {mcpTransport === 'stdio' ? (
            <>
              <input
                value={mcpCommand}
                onChange={(e) => setMcpCommand(e.target.value)}
                placeholder="Command (npx / python3)"
                className="glass-input rounded-xl px-3 py-2 font-mono text-xs text-white md:col-span-2"
              />
              <input
                value={mcpArgs}
                onChange={(e) => setMcpArgs(e.target.value)}
                placeholder="Args (space separated)"
                className="glass-input rounded-xl px-3 py-2 font-mono text-xs text-white md:col-span-3"
              />
            </>
          ) : (
            <input
              value={mcpUrl}
              onChange={(e) => setMcpUrl(e.target.value)}
              placeholder="http://127.0.0.1:3001/mcp"
              className="glass-input rounded-xl px-3 py-2 font-mono text-xs text-white md:col-span-5"
            />
          )}
          <button
            type="submit"
            className="flex items-center justify-center gap-1 rounded-xl border border-emerald-300/35 bg-emerald-400/20 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/30 md:col-span-2"
          >
            <Plus className="h-3.5 w-3.5" />
            {t.mcpAddServer}
          </button>
        </form>

        {mcpError && (
          <p className="mt-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
            {mcpError}
          </p>
        )}

        {/* Server List */}
        <div className="mt-4 space-y-2.5">
          {mcpServers.length === 0 ? (
            <p className="rounded-xl border border-white/8 bg-white/3 py-4 text-center text-xs text-slate-400">
              {t.mcpNoServers}
            </p>
          ) : (
            mcpServers.map((srv) => {
              const st = mcpStatuses.find((s) => s.id === srv.id);
              const connected = Boolean(st?.connected);
              const busy = mcpBusyId === srv.id;
              return (
                <div key={srv.id} className="glass-card rounded-xl p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            connected
                              ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                              : 'bg-slate-500/70'
                          }`}
                        />
                        <span className="text-xs font-semibold text-white">{srv.name}</span>
                        <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-cyan-200">
                          {srv.transport}
                        </span>
                        {connected && st && (
                          <span className="rounded bg-emerald-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-100">
                            {t.mcpToolsCount(st.tools.length)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate font-mono text-[11px] text-slate-400">
                        {srv.transport === 'stdio'
                          ? `${srv.command ?? ''} ${(srv.args ?? []).slice(0, 2).join(' ')}`
                          : srv.url}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {connected ? (
                        <button
                          onClick={() => onDisconnectMcpServer(srv.id)}
                          disabled={busy}
                          className="rounded-lg bg-rose-500/20 px-3 py-1 text-[11px] font-semibold text-rose-100 transition hover:bg-rose-500/35"
                        >
                          {t.mcpDisconnect}
                        </button>
                      ) : (
                        <button
                          onClick={() => onConnectMcpServer(srv)}
                          disabled={busy}
                          className="flex items-center gap-1 rounded-lg bg-emerald-400/25 px-3 py-1 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-400/35 disabled:opacity-50"
                        >
                          <Link2 className="h-3 w-3" />
                          {busy ? '...' : t.mcpConnect}
                        </button>
                      )}
                      <button
                        onClick={() => onRemoveMcpServer(srv.id)}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-500/20 hover:text-rose-200"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {connected && st && st.tools.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-white/8 pt-2.5">
                      {st.tools.map((tool) => (
                        <span
                          key={tool.name}
                          title={tool.description}
                          className="rounded-md border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 font-mono text-[10px] text-cyan-100"
                        >
                          {tool.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Custom OpenAI-Compatible & E2B Desktop Key */}
      <div className="grid gap-5 md:grid-cols-2">
        <section className="glass-panel rounded-2xl p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Cpu className="h-4 w-4 text-sky-300" />
            {t.customTitle}
          </h3>
          <p className="mt-1 text-xs text-slate-300/75">{t.customDesc}</p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-[11px] text-slate-300">Base URL</label>
              <input
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="glass-input w-full rounded-xl px-3 py-2 font-mono text-xs text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-300">Model</label>
              <input
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder="gpt-4o-mini / qwen2.5-coder:14b"
                className="glass-input w-full rounded-xl px-3 py-2 font-mono text-xs text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-300">{t.apiKeyLabel}</label>
              <input
                type="password"
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
                placeholder="sk-..."
                className="glass-input w-full rounded-xl px-3 py-2 font-mono text-xs text-white"
              />
            </div>
            <button
              onClick={applyCustom}
              className="w-full rounded-xl border border-cyan-300/35 bg-cyan-400/20 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/30"
            >
              {t.applyCustom}
            </button>
          </div>
        </section>

        <section className="glass-panel rounded-2xl p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Cloud className="h-4 w-4 text-violet-300" />
            {t.e2bTitle}
          </h3>
          <p className="mt-1 text-xs text-slate-300/75">{t.e2bDesc}</p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 flex items-center gap-1 text-[11px] text-slate-300">
                <KeyRound className="h-3 w-3 text-violet-300" />
                E2B_API_KEY
              </label>
              <input
                type="password"
                value={e2bApiKey}
                onChange={(e) => onChangeE2bApiKey(e.target.value)}
                placeholder="e2b_..."
                className="glass-input w-full rounded-xl px-3 py-2 font-mono text-xs text-white"
              />
            </div>
            <div className="rounded-xl border border-violet-300/20 bg-violet-400/8 p-3 text-[11px] leading-relaxed text-violet-100/85">
              <p className="font-semibold text-violet-200">{t.e2bHowTitle}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-300">
                {t.e2bBullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
