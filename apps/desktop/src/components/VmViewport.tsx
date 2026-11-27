import type { VmSessionState } from '@cage/agent-core';
import { Eye, Hand, Loader2, Monitor, Play, PowerOff, ShieldAlert } from 'lucide-react';
import type { DesktopMessages } from '../i18n';

interface VmViewportProps {
  vmState: VmSessionState;
  hasApiKey: boolean;
  onStartVm: () => void;
  onStopVm: () => void;
  onToggleTakeover: () => void;
  onOpenSetup: () => void;
  t: DesktopMessages['vm'];
}

export function VmViewport({
  vmState,
  hasApiKey,
  onStartVm,
  onStopVm,
  onToggleTakeover,
  onOpenSetup,
  t,
}: VmViewportProps) {
  const activeUrl = vmState.takeover ? vmState.interactiveStreamUrl : vmState.streamUrl;

  return (
    <div className="glass-panel flex h-full flex-col overflow-hidden rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/12 px-4 py-3">
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-violet-300" />
          <span className="text-xs font-semibold text-white">{t.header}</span>
          {vmState.sandboxId && (
            <span className="rounded-md bg-violet-400/20 px-1.5 py-0.5 font-mono text-[10px] text-violet-200">
              {vmState.sandboxId.slice(0, 12)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {vmState.status === 'running' && (
            <>
              <button
                onClick={onToggleTakeover}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  vmState.takeover
                    ? 'bg-amber-400/25 text-amber-100 ring-1 ring-amber-300/50'
                    : 'bg-white/10 text-slate-200 hover:bg-white/20'
                }`}
              >
                {vmState.takeover ? (
                  <>
                    <Hand className="h-3 w-3" /> {t.takeoverActive}
                  </>
                ) : (
                  <>
                    <Eye className="h-3 w-3" /> {t.watchMode}
                  </>
                )}
              </button>
              <button
                onClick={onStopVm}
                className="flex items-center gap-1 rounded-lg bg-rose-500/20 px-2.5 py-1 text-[11px] font-semibold text-rose-200 transition hover:bg-rose-500/35"
              >
                <PowerOff className="h-3 w-3" /> {t.stop}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="relative flex flex-1 items-center justify-center bg-slate-950/50">
        {vmState.status === 'running' && activeUrl ? (
          <iframe
            src={activeUrl}
            title="E2B Isolated Desktop Stream"
            className="h-full w-full border-0"
            allow="clipboard-read; clipboard-write"
          />
        ) : vmState.status === 'starting' ? (
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-violet-300" />
            <p className="text-sm font-medium text-white">{t.startingTitle}</p>
            <p className="text-xs text-slate-400">{t.startingDesc}</p>
          </div>
        ) : (
          <div className="flex max-w-sm flex-col items-center gap-4 p-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-300/30 bg-violet-500/15">
              <Monitor className="h-7 w-7 text-violet-200" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">{t.idleTitle}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-300/80">{t.idleDesc}</p>
            </div>

            {vmState.error && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-400/35 bg-rose-500/15 p-3 text-left text-[11px] text-rose-100">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                <span>{vmState.error}</span>
              </div>
            )}

            {hasApiKey ? (
              <button
                onClick={onStartVm}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-400 to-cyan-400 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-[0_8px_28px_rgba(139,92,246,0.35)] transition hover:brightness-110"
              >
                <Play className="h-3.5 w-3.5" />
                {t.startBtn}
              </button>
            ) : (
              <button
                onClick={onOpenSetup}
                className="glass-pill rounded-xl px-4 py-2 text-xs font-semibold text-violet-100 transition hover:bg-white/15"
              >
                {t.setupKeyBtn}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
