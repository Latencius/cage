import type { AgentRuntime, ExecutionMode, LlmConfig } from '@cage/agent-core';
import {
  Cpu,
  Globe,
  Lock,
  Monitor,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
} from 'lucide-react';
import { LOCALE_OPTIONS, type DesktopMessages, type Locale } from '../i18n';

export type ActiveTab = 'mission' | 'setup' | 'safety';

interface GlassHeaderProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  mode: ExecutionMode;
  onChangeMode: (mode: ExecutionMode) => void;
  runtime: AgentRuntime;
  mcpToolCount: number;
  llm: LlmConfig;
  allowedFolderCount: number;
  vmRunning: boolean;
  locale: Locale;
  onChangeLocale: (locale: Locale) => void;
  onOpenStarPopup: () => void;
  t: DesktopMessages['header'];
}

export function GlassHeader({
  activeTab,
  onSelectTab,
  mode,
  onChangeMode,
  runtime,
  mcpToolCount,
  llm,
  allowedFolderCount,
  vmRunning,
  locale,
  onChangeLocale,
  onOpenStarPopup,
  t,
}: GlassHeaderProps) {
  return (
    <header className="drag-region glass-panel mx-3 mt-3 flex items-center justify-between gap-2 rounded-2xl px-4 py-2.5 pl-20">
      {/* Brand */}
      <div className="no-drag flex items-center gap-3">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/25 bg-gradient-to-br from-cyan-300/35 via-sky-400/20 to-indigo-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
          <Shield className="h-5 w-5 text-cyan-200" />
          <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border border-slate-950 bg-emerald-400 shadow-[0_0_8px_#34d399]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-wide text-white">Cage</span>
            <span className="rounded-full border border-white/15 bg-white/8 px-2 py-0.5 text-[10px] font-medium text-cyan-200/90">
              v0.2
            </span>
          </div>
          <p className="text-[11px] text-slate-300/80">
            {runtime === 'openclaw'
              ? 'OpenClaw Gateway'
              : llm.demoMode
                ? t.demoActive
                : `${llm.providerName} · ${llm.model || t.unselected}`}
            {mcpToolCount > 0 ? ` · ${mcpToolCount} MCP` : ''}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="no-drag glass-pill flex items-center gap-1 rounded-xl p-1">
        <button
          onClick={() => onSelectTab('mission')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            activeTab === 'mission'
              ? 'bg-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]'
              : 'text-slate-300 hover:bg-white/8 hover:text-white'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {t.tabMission}
        </button>
        <button
          onClick={() => onSelectTab('setup')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            activeTab === 'setup'
              ? 'bg-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]'
              : 'text-slate-300 hover:bg-white/8 hover:text-white'
          }`}
        >
          <Cpu className="h-3.5 w-3.5" />
          {t.tabSetup}
        </button>
        <button
          onClick={() => onSelectTab('safety')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            activeTab === 'safety'
              ? 'bg-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]'
              : 'text-slate-300 hover:bg-white/8 hover:text-white'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {t.tabSafety}
          <span className="rounded-full bg-white/15 px-1.5 text-[10px] text-cyan-200">
            {allowedFolderCount}
          </span>
        </button>
      </nav>

      {/* Right Controls: Mode Toggle + Language */}
      <div className="no-drag flex items-center gap-2">
        <div className="glass-pill flex items-center gap-1 rounded-xl p-1">
          <button
            onClick={() => onChangeMode('local')}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
              mode === 'local'
                ? 'bg-emerald-400/25 text-emerald-100 ring-1 ring-emerald-300/40'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
            {t.modeLocal}
          </button>
          <button
            onClick={() => onChangeMode('isolated_vm')}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
              mode === 'isolated_vm'
                ? 'bg-violet-400/30 text-violet-100 ring-1 ring-violet-300/45'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Monitor className="h-3.5 w-3.5 text-violet-300" />
            {t.modeVm}
            {vmRunning && (
              <span className="h-1.5 w-1.5 rounded-full bg-violet-300 shadow-[0_0_8px_#c4b5fd]" />
            )}
          </button>
          <div className="ml-1 hidden items-center gap-1 border-l border-white/10 pl-2 pr-1 text-[11px] text-slate-300/80 xl:flex">
            <Lock className="h-3 w-3 text-cyan-300" />
            {t.rustGuard}
          </div>
        </div>

        {/* Star on GitHub trigger */}
        <button
          onClick={onOpenStarPopup}
          title="Star Cage on GitHub"
          className="glass-pill flex h-8 w-8 items-center justify-center rounded-xl text-amber-200 transition hover:bg-amber-400/20"
        >
          <Star className="h-3.5 w-3.5 fill-amber-300/80 text-amber-200" />
        </button>

        {/* Language Switcher */}
        <div className="glass-pill flex items-center gap-0.5 rounded-xl p-1">
          <Globe className="ml-1 mr-0.5 h-3 w-3 text-cyan-200/80" />
          {LOCALE_OPTIONS.map((opt) => (
            <button
              key={opt.code}
              onClick={() => onChangeLocale(opt.code)}
              className={`rounded-lg px-1.5 py-1 text-[10px] font-semibold transition ${
                locale === opt.code
                  ? 'bg-white/20 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
