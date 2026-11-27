import { useState } from 'react';
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

type DemoStep =
  | { id: string; kind: 'log'; text: string; ok?: boolean }
  | { id: string; kind: 'blocked'; text: string };

export function InteractiveDemo() {
  const [mode, setMode] = useState<'local' | 'vm'>('local');
  const [takeover, setTakeover] = useState(false);
  const [pending, setPending] = useState<{
    tool: string;
    summary: string;
    args: string;
  } | null>({
    tool: 'delete_file',
    summary: '古い請求書PDFを削除: ~/CageWorkspace/old-draft-2025.pdf',
    args: '{\n  "path": "~/CageWorkspace/old-draft-2025.pdf"\n}',
  });
  const [logs, setLogs] = useState<DemoStep[]>([
    { id: '1', kind: 'log', text: 'Ollama (:11434) 自動検知 → qwen2.5-coder:14b 接続完了 (12ms)', ok: true },
    { id: '2', kind: 'log', text: 'list_dir(".") → 自動許可（許可フォルダ内）で 8 件取得', ok: true },
  ]);

  const handleApprove = () => {
    if (!pending) return;
    setLogs((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        kind: 'log',
        text: `ワンタイムトークン発行 → ${pending.tool} を安全に実行完了`,
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
        text: `ユーザーが拒否 → ${pending.tool} を中止しエージェントへ通知`,
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
        text: 'Rust境界が遮断: read_file("../../etc/passwd") は許可フォルダ外のため物理ブロック',
      },
    ]);
  };

  const triggerShell = () => {
    setPending({
      tool: 'run_shell',
      summary: 'シェルコマンド実行: ls -la && du -sh .',
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
            Local Mode
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
            隔離VM Mode
          </button>
        </div>
      </div>

      {/* Body */}
      <div className={`grid gap-4 p-5 ${mode === 'vm' ? 'md:grid-cols-12' : 'grid-cols-1'}`}>
        <div className={mode === 'vm' ? 'space-y-3 md:col-span-6' : 'space-y-3'}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <FolderLock className="h-3.5 w-3.5 text-emerald-300" />
              {mode === 'local' ? '許可フォルダ: ~/CageWorkspace' : 'ローカルファイル完全遮断中'}
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={triggerShell}
                className="rounded-lg border border-white/15 bg-white/8 px-2.5 py-1 text-[11px] text-cyan-100 transition hover:bg-white/15"
              >
                + 承認テスト
              </button>
              <button
                onClick={triggerTraversal}
                className="rounded-lg border border-rose-400/30 bg-rose-500/15 px-2.5 py-1 text-[11px] text-rose-100 transition hover:bg-rose-500/25"
              >
                + 脱出アタック試行
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
                HUMAN APPROVAL REQUIRED — 実行一時停止中
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
                  <X className="h-3.5 w-3.5" /> 拒否する
                </button>
                <button
                  onClick={handleApprove}
                  className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 transition hover:brightness-110"
                >
                  <Check className="h-3.5 w-3.5" /> 今回のみ許可
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
                    <Hand className="h-3 w-3" /> 手動操作中
                  </>
                ) : (
                  <>
                    <Eye className="h-3 w-3" /> 監視モード
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
                <p className="mt-2 text-slate-300/85">
                  [Isolated Stream Active] 1280×800 · Encrypted noVNC WebSocket
                </p>
                <p className="mt-1 text-emerald-300/90">
                  {takeover
                    ? '→ 人間のマウス/キーボード入力が有効です（ログイン・CAPTCHA対応可）'
                    : '→ エージェントが自律操作中。いつでも「手動操作」で横取りできます'}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Lock className="h-3 w-3 text-violet-300" /> ホストMac/Windowsから完全隔離
                </span>
                <span>セッション終了時にVM破棄</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
