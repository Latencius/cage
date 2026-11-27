import type { PendingApprovalView } from '@cage/agent-core';
import { AlertTriangle, Check, Fingerprint, ShieldAlert, X } from 'lucide-react';

interface ApprovalGateProps {
  pending: PendingApprovalView;
  onApprove: () => void;
  onDeny: () => void;
}

export function ApprovalGate({ pending, onApprove, onDeny }: ApprovalGateProps) {
  const isHigh = pending.risk === 'high';

  return (
    <div className="glass-alert rounded-2xl p-4 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              isHigh
                ? 'bg-rose-500/25 text-rose-200 ring-1 ring-rose-400/50'
                : 'bg-amber-400/25 text-amber-100 ring-1 ring-amber-300/50'
            }`}
          >
            {isHigh ? <ShieldAlert className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wide text-amber-100">
                HUMAN APPROVAL REQUIRED
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                  isHigh
                    ? 'bg-rose-500/30 text-rose-100'
                    : 'bg-amber-400/30 text-amber-100'
                }`}
              >
                {pending.risk} risk
              </span>
            </div>
            <p className="mt-0.5 text-sm font-semibold text-white">{pending.summary}</p>
          </div>
        </div>
        <span className="hidden items-center gap-1 rounded-lg bg-black/25 px-2 py-1 font-mono text-[10px] text-amber-200/80 sm:inline-flex">
          <Fingerprint className="h-3 w-3" />
          {pending.challenge.argsHash.slice(0, 10)}
        </span>
      </div>

      {/* Arguments Inspector */}
      <pre className="mt-3 max-h-40 overflow-auto rounded-xl border border-white/12 bg-slate-950/60 p-3 font-mono text-[11px] leading-relaxed text-cyan-100/90">
        {JSON.stringify(pending.args, null, 2)}
      </pre>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-amber-100/75">
          承認すると Rust 安全境界がこの引数専用のワンタイム実行トークンを発行します。
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onDeny}
            className="flex items-center gap-1.5 rounded-xl border border-rose-300/35 bg-rose-500/20 px-4 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/35"
          >
            <X className="h-3.5 w-3.5" />
            拒否する
          </button>
          <button
            onClick={onApprove}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 shadow-[0_6px_22px_rgba(52,211,153,0.35)] transition hover:brightness-110"
          >
            <Check className="h-3.5 w-3.5" />
            今回のみ許可
          </button>
        </div>
      </div>
    </div>
  );
}
