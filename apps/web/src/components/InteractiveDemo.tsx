import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Eye,
  FolderLock,
  Hand,
  Lock,
  Monitor,
  Shield,
  ShieldCheck,
  Terminal,
  X,
  XCircle,
} from 'lucide-react';
import type { WebMessages } from '../i18n';

type DemoStep =
  | { id: string; kind: 'log'; text: string; ok?: boolean }
  | { id: string; kind: 'blocked'; text: string };

interface InteractiveDemoProps {
  t: WebMessages['demo'];
}

export function InteractiveDemo({ t }: InteractiveDemoProps) {
  const [mode, setMode] = useState<'local' | 'vm'>('local');
  const [takeover, setTakeover] = useState(false);
  const [pending, setPending] = useState<{
    tool: string;
    summary: string;
    args: string;
  } | null>({
    tool: 'delete_file',
    summary: t.initialSummary,
    args: '{\n  "path": "~/CageWorkspace/old-draft-2025.pdf"\n}',
  });
  const [logs, setLogs] = useState<DemoStep[]>([
    { id: '1', kind: 'log', text: t.initialLog1, ok: true },
    { id: '2', kind: 'log', text: t.initialLog2, ok: true },
  ]);

  useEffect(() => {
    setLogs([
      { id: '1', kind: 'log', text: t.initialLog1, ok: true },
      { id: '2', kind: 'log', text: t.initialLog2, ok: true },
    ]);
    setPending({
      tool: 'delete_file',
      summary: t.initialSummary,
      args: '{\n  "path": "~/CageWorkspace/old-draft-2025.pdf"\n}',
    });
  }, [t]);

  const handleApprove = () => {
    if (!pending) return;
    setLogs((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        kind: 'log',
        text: t.approvedLog(pending.tool),
        ok: true,
      },
    ]);
    setPending(null);
  };

  const handleDeny = () => {
    if (!pending) return;
    setLogs((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        kind: 'blocked',
        text: t.deniedLog(pending.tool),
      },
    ]);
    setPending(null);
  };

  const triggerTraversal = () => {
    setLogs((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        kind: 'blocked',
        text: t.blockedEscapeLog,
      },
    ]);
  };

  const triggerShell = () => {
    setPending({
      tool: 'run_shell',
      summary: t.shellSummary,
      args: '{\n  "command": "ls -la && du -sh .",\n  "cwd": "~/CageWorkspace"\n}',
    });
  };

  return (
    <div className="glass-surface overflow-hidden rounded-3xl">
      {/* Mock Window Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/12 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-rose-400/80" />
            <span className="h-3 w-3 rounded-full bg-amber-300/80" />
            <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <Shield className="h-4 w-4 text-cyan-300" />
            Cage Desktop Preview
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center gap-1 rounded-xl border border-white/15 bg-white/8 p-1">
          <button
            onClick={() => setMode('local')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition ${
              mode === 'local'
                ? 'bg-emerald-400/25 text-emerald-100 ring-1 ring-emerald-300/45'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
            {t.localLabel}
          </button>
          <button
            onClick={() => setMode('vm')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition ${
              mode === 'vm'
                ? 'bg-violet-400/30 text-violet-100 ring-1 ring-violet-300/45'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Monitor className="h-3.5 w-3.5 text-violet-300" />
            {t.vmLabel}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className={`grid gap-4 p-5 ${mode === 'vm' ? 'md:grid-cols-12' : 'grid-cols-1'}`}>
        <div className={mode === 'vm' ? 'space-y-3 md:col-span-6' : 'space-y-3'}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <FolderLock className="h-3.5 w-3.5 text-emerald-300" />
              {mode === 'local' ? t.allowedFolder : t.localBlocked}
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={triggerShell}
                className="rounded-lg border border-white/15 bg-white/8 px-2.5 py-1 text-[11px] text-cyan-100 transition hover:bg-white/15"
              >
                {t.btnApprovalTest}
              </button>
              <button
                onClick={triggerTraversal}
                className="rounded-lg border border-rose-400/30 bg-rose-500/15 px-2.5 py-1 text-[11px] text-rose-100 transition hover:bg-rose-500/25"
              >
                {t.btnEscapeTest}
              </button>
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-2">
            {logs.slice(-5).map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
                  item.kind === 'blocked'
                    ? 'border-rose-400/35 bg-rose-500/15 text-rose-100'
                    : 'border-white/10 bg-white/5 text-slate-200'
                }`}
              >
                {item.kind === 'blocked' ? (
                  <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-300" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                )}
                <span>{item.text}</span>
              </div>
            ))}
          </div>

          {/* Interactive Approval Gate */}
          {pending && (
            <div className="glass-warning rounded-2xl p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-100">
                <AlertTriangle className="h-4 w-4 text-amber-300" />
                {t.approvalHeader}
              </div>
              <p className="mt-1 text-sm font-semibold text-white">{pending.summary}</p>
              <pre className="mt-2 rounded-xl bg-slate-950/60 p-2.5 font-mono text-[11px] text-cyan-100">
                {pending.args}
              </pre>
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  onClick={handleDeny}
                  className="flex items-center gap-1 rounded-xl border border-rose-300/35 bg-rose-500/25 px-3.5 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/40"
                >
                  <X className="h-3.5 w-3.5" /> {t.denyBtn}
                </button>
                <button
                  onClick={handleApprove}
                  className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 transition hover:brightness-110"
                >
                  <Check className="h-3.5 w-3.5" /> {t.approveBtn}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Simulated E2B Desktop Stream */}
        {mode === 'vm' && (
          <div className="glass-tile flex flex-col overflow-hidden rounded-2xl md:col-span-6">
            <div className="flex items-center justify-between border-b border-white/10 px-3.5 py-2.5 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-violet-200">
                <Monitor className="h-3.5 w-3.5" /> E2B Desktop (Ubuntu XFCE · noVNC)
              </span>
              <button
                onClick={() => setTakeover((v) => !v)}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  takeover
                    ? 'bg-amber-400/25 text-amber-100 ring-1 ring-amber-300/50'
                    : 'bg-white/10 text-slate-200 hover:bg-white/20'
                }`}
              >
                {takeover ? (
                  <>
                    <Hand className="h-3 w-3" /> {t.takeoverActive}
                  </>
                ) : (
                  <>
                    <Eye className="h-3 w-3" /> {t.watchMode}
                  </>
                )}
              </button>
            </div>
            <div className="flex flex-1 flex-col justify-between bg-slate-950/75 p-4 font-mono text-[11px] text-slate-300">
              <div className="rounded-xl border border-violet-300/20 bg-violet-950/35 p-3">
                <div className="flex items-center gap-2 text-violet-200">
                  <Terminal className="h-3.5 w-3.5" />
                  <span>user@e2b-sandbox:~$ google-chrome --no-sandbox</span>
                </div>
                <p className="mt-2 text-slate-300/85">{t.vmStreamActive}</p>
                <p className="mt-1 text-emerald-300/90">
                  {takeover ? t.vmTakeoverHint : t.vmWatchHint}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Lock className="h-3 w-3 text-violet-300" /> {t.vmIsolatedHost}
                </span>
                <span>{t.vmEphemeral}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
