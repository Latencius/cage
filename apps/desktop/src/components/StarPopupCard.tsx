import { openUrl } from '@tauri-apps/plugin-opener';
import { ExternalLink, Github, Star, X } from 'lucide-react';
import type { DesktopMessages } from '../i18n';
import { isTauriRuntime } from '../lib/tauri-bridge';

const REPO_URL = 'https://github.com/Latencius/cage';

interface StarPopupCardProps {
  open: boolean;
  onStarred: () => void;
  onLater: () => void;
  onNever: () => void;
  t: DesktopMessages['starPrompt'];
}

export function StarPopupCard({ open, onStarred, onLater, onNever, t }: StarPopupCardProps) {
  if (!open) return null;

  const handleOpenGitHub = async () => {
    try {
      if (isTauriRuntime()) {
        await openUrl(REPO_URL);
      } else {
        window.open(REPO_URL, '_blank', 'noopener,noreferrer');
      }
    } catch {
      window.open(REPO_URL, '_blank', 'noopener,noreferrer');
    }
    onStarred();
  };

  return (
    <div
      role="dialog"
      aria-label={t.title}
      className="fixed right-4 bottom-4 z-50 w-[calc(100vw-2rem)] max-w-sm animate-[fadeInUp_0.3s_ease-out]"
    >
      <div className="relative overflow-hidden rounded-2xl border border-amber-200/35 bg-slate-950/85 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_24px_60px_rgba(2,6,23,0.75)] backdrop-blur-2xl">
        <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-amber-300/20 blur-2xl" />

        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-300/40 bg-gradient-to-br from-amber-300/30 to-orange-400/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
              <Star className="h-5 w-5 fill-amber-300 text-amber-200" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/8 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                <Github className="h-2.5 w-2.5" />
                {t.badge}
              </span>
              <h3 className="mt-1 text-sm font-semibold text-white">{t.title}</h3>
            </div>
          </div>

          <button
            onClick={onLater}
            aria-label="Close"
            className="rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="relative mt-2.5 text-xs leading-relaxed text-slate-300/90">{t.desc}</p>

        <div className="relative mt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={onNever}
            className="text-[11px] text-slate-400 transition hover:text-slate-200"
          >
            {t.never}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onLater}
              className="rounded-xl border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/15"
            >
              {t.later}
            </button>
            <button
              onClick={handleOpenGitHub}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-[0_6px_22px_rgba(251,191,36,0.35)] transition hover:brightness-110"
            >
              <Star className="h-3.5 w-3.5 fill-slate-950" />
              {t.cta}
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
