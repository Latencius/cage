import { useEffect, useRef, useState } from 'react';
import type {
  ExecutionMode,
  PendingApprovalView,
  TimelineEvent,
  VmSessionState,
} from '@cage/agent-core';
import {
  Bot,
  CheckCircle2,
  FolderLock,
  Loader2,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
  Terminal,
  Trash2,
  User,
  XCircle,
} from 'lucide-react';
import type { DesktopMessages } from '../i18n';
import { ApprovalGate } from './ApprovalGate';
import { VmViewport } from './VmViewport';

interface MissionControlProps {
  mode: ExecutionMode;
  events: TimelineEvent[];
  running: boolean;
  pendingApproval: PendingApprovalView | null;
  allowedDirs: string[];
  vmState: VmSessionState;
  hasE2bKey: boolean;
  onSendPrompt: (prompt: string) => void;
  onStopRun: () => void;
  onClearTimeline: () => void;
  onApprove: () => void;
  onDeny: () => void;
  onStartVm: () => void;
  onStopVm: () => void;
  onToggleTakeover: () => void;
  onOpenSetup: () => void;
  onOpenSafety: () => void;
  t: DesktopMessages;
}

export function MissionControl({
  mode,
  events,
  running,
  pendingApproval,
  allowedDirs,
  vmState,
  hasE2bKey,
  onSendPrompt,
  onStopRun,
  onClearTimeline,
  onApprove,
  onDeny,
  onStartVm,
  onStopVm,
  onToggleTakeover,
  onOpenSetup,
  onOpenSafety,
  t,
}: MissionControlProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [events, pendingApproval]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || running) return;
    setInput('');
    onSendPrompt(trimmed);
  };

  const presets = mode === 'isolated_vm' ? t.mission.vmPresets : t.mission.localPresets;

  return (
    <div
      className={`grid h-full gap-3 overflow-hidden p-3 ${
        mode === 'isolated_vm' ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'
      }`}
    >
      {/* Left / Main: Chat & Transparent Execution Timeline */}
      <div
        className={`glass-panel flex min-h-0 flex-col overflow-hidden rounded-2xl ${
          mode === 'isolated_vm' ? 'lg:col-span-6' : 'mx-auto w-full max-w-5xl'
        }`}
      >
        {/* Sub-header status strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            {mode === 'local' ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-200 ring-1 ring-emerald-300/30">
                  <ShieldCheck className="h-3 w-3" />
                  {t.mission.localSafeMode}
                </span>
                <button
                  onClick={onOpenSafety}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-300/80 transition hover:text-cyan-200"
                >
                  <FolderLock className="h-3 w-3" />
                  {allowedDirs.length > 0
                    ? t.mission.allowedFolder(allowedDirs[0], allowedDirs.length - 1)
                    : t.mission.noAllowedFolder}
                </button>
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-400/20 px-2.5 py-0.5 text-[11px] font-medium text-violet-100 ring-1 ring-violet-300/35">
                <ShieldAlert className="h-3 w-3" />
                {t.mission.vmBanner}
              </span>
            )}
          </div>

          {events.length > 0 && (
            <button
              onClick={onClearTimeline}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <Trash2 className="h-3 w-3" />
              {t.mission.clear}
            </button>
          )}
        </div>

        {/* Timeline Stream */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {events.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-8 text-center">
              <div className="glass-card mb-4 flex h-16 w-16 items-center justify-center rounded-3xl">
                <Sparkles className="h-8 w-8 text-cyan-200" />
              </div>
              <h1 className="text-lg font-semibold text-white">{t.mission.emptyTitle}</h1>
              <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-300/80">
                {t.mission.emptyDesc}
              </p>

              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {presets.map((p) => (
                  <button
                    key={p}
                    onClick={() => onSendPrompt(p)}
                    className="glass-pill rounded-xl px-3.5 py-2 text-xs text-slate-200 transition hover:bg-white/15 hover:text-white"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            events.map((evt) => <TimelineItem key={evt.id} event={evt} />)
          )}

          {pendingApproval && (
            <ApprovalGate
              pending={pendingApproval}
              onApprove={onApprove}
              onDeny={onDeny}
              t={t.approval}
            />
          )}

          {running && !pendingApproval && (
            <div className="flex items-center gap-2 px-2 text-xs text-cyan-200/80">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t.mission.runningText}
            </div>
          )}
        </div>

        {/* Prompt Composer */}
        <form onSubmit={handleSubmit} className="border-t border-white/10 p-3">
          <div className="glass-input flex items-center gap-2 rounded-2xl px-3 py-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                mode === 'isolated_vm' ? t.mission.placeholderVm : t.mission.placeholderLocal
              }
              disabled={running}
              className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
            />
            {running ? (
              <button
                type="button"
                onClick={onStopRun}
                className="flex items-center gap-1 rounded-xl bg-rose-500/30 px-3.5 py-2 text-xs font-semibold text-rose-100 ring-1 ring-rose-400/40 transition hover:bg-rose-500/45"
              >
                <Square className="h-3 w-3 fill-current" />
                {t.mission.stop}
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 px-4 py-2 text-xs font-bold text-slate-950 shadow-[0_6px_20px_rgba(56,189,248,0.3)] transition hover:brightness-110 disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
                {t.mission.run}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Right Pane: Isolated VM Viewport */}
      {mode === 'isolated_vm' && (
        <div className="min-h-[340px] lg:col-span-6 lg:min-h-0">
          <VmViewport
            vmState={vmState}
            hasApiKey={hasE2bKey}
            onStartVm={onStartVm}
            onStopVm={onStopVm}
            onToggleTakeover={onToggleTakeover}
            onOpenSetup={onOpenSetup}
            t={t.vm}
          />
        </div>
      )}
    </div>
  );
}

function TimelineItem({ event }: { event: TimelineEvent }) {
  if (event.kind === 'user') {
    return (
      <div className="flex justify-end">
        <div className="flex max-w-[82%] items-start gap-2.5 rounded-2xl rounded-tr-sm border border-cyan-300/30 bg-cyan-400/18 px-4 py-2.5 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]">
          <p className="whitespace-pre-wrap leading-relaxed">{event.detail}</p>
          <User className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
        </div>
      </div>
    );
  }

  if (event.kind === 'assistant') {
    return (
      <div className="glass-card flex items-start gap-3 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-100">
        <Bot className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
        <div className="min-w-0 flex-1 whitespace-pre-wrap leading-relaxed">{event.detail}</div>
      </div>
    );
  }

  if (event.kind === 'tool_call' || event.kind === 'thought') {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/4 px-3.5 py-2.5 text-xs text-slate-200">
        <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300" />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-white">{event.title}</div>
          {event.detail && <p className="mt-1 text-slate-300/80">{event.detail}</p>}
        </div>
      </div>
    );
  }

  if (event.kind === 'approval_granted' || event.kind === 'approval_denied') {
    const granted = event.kind === 'approval_granted';
    return (
      <div
        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
          granted
            ? 'border-emerald-300/30 bg-emerald-400/12 text-emerald-100'
            : 'border-rose-400/35 bg-rose-500/15 text-rose-100'
        }`}
      >
        {granted ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
        ) : (
          <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-300" />
        )}
        <span>{event.title}</span>
      </div>
    );
  }

  if (event.kind === 'tool_result') {
    return (
      <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-slate-200">
          {event.ok ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-rose-300" />
          )}
          <span>{event.title}</span>
        </div>
        {event.detail && (
          <pre className="mt-2 max-h-44 overflow-auto font-mono text-[11px] leading-relaxed text-slate-300">
            {event.detail}
          </pre>
        )}
        {event.screenshotBase64 && (
          <img
            src={`data:image/png;base64,${event.screenshotBase64}`}
            alt="Isolated VM Screenshot"
            className="mt-2 max-h-64 rounded-lg border border-white/15"
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
      <span>{event.title}</span>
    </div>
  );
}
