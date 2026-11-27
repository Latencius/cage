import type { AuditEntry, PermissionLevel, SecurityPolicy, ToolCategory } from '@cage/agent-core';
import {
  FolderLock,
  FolderPlus,
  History,
  ShieldCheck,
  ShieldOff,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

interface SafetyPanelProps {
  policy: SecurityPolicy;
  auditLog: AuditEntry[];
  onAddFolder: () => void;
  onRemoveFolder: (dir: string) => void;
  onChangePermission: (category: ToolCategory, level: PermissionLevel) => void;
  onClearAudit: () => void;
}

const TOOL_ROWS: Array<{
  category: ToolCategory;
  label: string;
  desc: string;
  recommended: PermissionLevel;
}> = [
  {
    category: 'fs_read',
    label: 'ファイル読み取り / 一覧',
    desc: '許可フォルダ内のファイル内容確認やディレクトリ一覧取得',
    recommended: 'auto_allow',
  },
  {
    category: 'fs_write',
    label: 'ファイル作成 / 編集 / 移動',
    desc: '許可フォルダ内への新規保存・上書き・リネーム',
    recommended: 'require_approval',
  },
  {
    category: 'fs_delete',
    label: 'ファイル / フォルダ削除',
    desc: '復元困難な削除操作（常に承認必須を推奨）',
    recommended: 'require_approval',
  },
  {
    category: 'shell_exec',
    label: 'シェルコマンド実行',
    desc: '許可フォルダをカレントにしてターミナルコマンドを実行（破壊コマンドはRustで常時禁止）',
    recommended: 'require_approval',
  },
  {
    category: 'web_fetch',
    label: 'Webページ取得 (HTTP GET)',
    desc: '指定URLのテキスト・ドキュメントを取得',
    recommended: 'auto_allow',
  },
  {
    category: 'vm_control',
    label: '隔離VM操作 (Computer Use)',
    desc: 'E2BクラウドVM上での画面クリック・文字入力・アプリ起動・Bash実行',
    recommended: 'require_approval',
  },
];

const LEVEL_OPTIONS: Array<{ value: PermissionLevel; label: string; activeClass: string }> = [
  {
    value: 'auto_allow',
    label: '自動許可',
    activeClass: 'bg-emerald-400/25 text-emerald-100 ring-1 ring-emerald-300/45',
  },
  {
    value: 'require_approval',
    label: '毎回承認',
    activeClass: 'bg-amber-400/25 text-amber-100 ring-1 ring-amber-300/45',
  },
  {
    value: 'deny',
    label: '禁止',
    activeClass: 'bg-rose-500/25 text-rose-100 ring-1 ring-rose-400/45',
  },
];

export function SafetyPanel({
  policy,
  auditLog,
  onAddFolder,
  onRemoveFolder,
  onChangePermission,
  onClearAudit,
}: SafetyPanelProps) {
  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-5 overflow-y-auto px-4 py-5">
      {/* Allowed Folders */}
      <section className="glass-panel rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <FolderLock className="h-4 w-4 text-emerald-300" />
              アクセス許可フォルダ（Rust物理サンドボックス）
            </h2>
            <p className="mt-1 text-xs text-slate-300/80">
              ここに追加したフォルダ配下のみローカル操作を許可します。<code>..</code> トラバーサルやシンボリックリンク脱出も Rust 層で遮断します。
            </p>
          </div>
          <button
            onClick={onAddFolder}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-400/85 to-cyan-400/85 px-4 py-2 text-xs font-bold text-slate-950 shadow-[0_6px_22px_rgba(52,211,153,0.28)] transition hover:brightness-110"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            フォルダを追加
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {policy.allowedDirs.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-amber-300/30 bg-amber-400/10 p-3.5 text-xs text-amber-100">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
              許可フォルダが未設定です（デフォルト安全状態）。ローカルファイル操作を使うには「フォルダを追加」から作業ディレクトリを1つ指定してください。
            </div>
          ) : (
            policy.allowedDirs.map((dir) => (
              <div
                key={dir}
                className="glass-card flex items-center justify-between rounded-xl px-3.5 py-2.5"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" />
                  <span className="truncate font-mono text-xs text-slate-100">{dir}</span>
                </div>
                <button
                  onClick={() => onRemoveFolder(dir)}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-500/20 hover:text-rose-200"
                  title="許可リストから削除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Permission Matrix */}
      <section className="glass-panel rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <ShieldOff className="h-4 w-4 text-cyan-300" />
          ツール別・承認ファイアウォール設定
        </h2>
        <p className="mt-1 text-xs text-slate-300/80">
          「毎回承認」に設定された操作は、あなたが承認ボタンを押すまで Rust バックエンドが物理的に実行をロックします。
        </p>

        <div className="mt-4 divide-y divide-white/10">
          {TOOL_ROWS.map((row) => {
            const current = policy.permissions[row.category] ?? 'deny';
            return (
              <div
                key={row.category}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="max-w-lg">
                  <div className="text-xs font-semibold text-white">{row.label}</div>
                  <div className="mt-0.5 text-[11px] text-slate-400">{row.desc}</div>
                </div>
                <div className="glass-pill flex items-center gap-1 rounded-xl p-1">
                  {LEVEL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => onChangePermission(row.category, opt.value)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                        current === opt.value
                          ? opt.activeClass
                          : 'text-slate-300 hover:bg-white/8 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Audit Log */}
      <section className="glass-panel rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <History className="h-4 w-4 text-sky-300" />
            Rust セキュリティ監査ログ（最新 {auditLog.length} 件）
          </h2>
          {auditLog.length > 0 && (
            <button
              onClick={onClearAudit}
              className="rounded-lg bg-white/8 px-2.5 py-1 text-[11px] text-slate-300 transition hover:bg-white/15"
            >
              ログをクリア
            </button>
          )}
        </div>

        <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto">
          {auditLog.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">
              まだツール実行の監査履歴はありません。
            </p>
          ) : (
            [...auditLog].reverse().map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-slate-950/35 px-3 py-2 text-[11px]"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      entry.ok ? 'bg-emerald-400' : 'bg-rose-400'
                    }`}
                  />
                  <span className="font-mono font-semibold text-cyan-200">{entry.toolName}</span>
                  <span className="truncate text-slate-300">{entry.summary}</span>
                </div>
                <span className="shrink-0 rounded bg-white/8 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                  {entry.decision}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
