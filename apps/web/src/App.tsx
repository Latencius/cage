import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Cpu,
  Download,
  FolderLock,
  Github,
  Lock,
  Monitor,
  Shield,
  ShieldCheck,
  Sparkles,
  Wifi,
} from 'lucide-react';
import { InteractiveDemo } from './components/InteractiveDemo';

interface ReleaseInfo {
  tagName: string;
  htmlUrl: string;
  macArmUrl?: string;
  winUrl?: string;
}

const DEFAULT_REPO = 'cage-ai/cage';

function detectRepoSlug(): string {
  if (typeof window === 'undefined') return DEFAULT_REPO;
  const host = window.location.hostname;
  if (host.endsWith('.github.io')) {
    const owner = host.replace('.github.io', '');
    const seg = window.location.pathname.split('/').filter(Boolean)[0];
    if (owner && seg) return `${owner}/${seg}`;
  }
  return DEFAULT_REPO;
}

export default function App() {
  const [repo] = useState(detectRepoSlug);
  const [release, setRelease] = useState<ReleaseInfo | null>(null);

  useEffect(() => {
    fetch(`https://api.github.com/repos/${repo}/releases/latest`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.tag_name) return;
        const assets: Array<{ name: string; browser_download_url: string }> = data.assets ?? [];
        const macArm = assets.find((a) => a.name.endsWith('.dmg') && a.name.includes('aarch64'))
          ?? assets.find((a) => a.name.endsWith('.dmg'));
        const win = assets.find((a) => a.name.endsWith('.msi') || a.name.endsWith('.exe'));
        setRelease({
          tagName: data.tag_name,
          htmlUrl: data.html_url,
          macArmUrl: macArm?.browser_download_url,
          winUrl: win?.browser_download_url,
        });
      })
      .catch(() => {
        // Fallback to Releases page
      });
  }, [repo]);

  const repoUrl = `https://github.com/${repo}`;
  const releasesUrl = release?.htmlUrl ?? `${repoUrl}/releases`;

  return (
    <div className="lp-bg min-h-screen text-slate-100">
      {/* Glass Topbar */}
      <header className="sticky top-0 z-30 mx-auto max-w-6xl px-4 pt-4">
        <div className="glass-surface flex items-center justify-between rounded-2xl px-5 py-3">
          <a href="#" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/25 bg-gradient-to-br from-cyan-300/35 to-indigo-500/35">
              <Shield className="h-4 w-4 text-cyan-200" />
            </div>
            <span className="text-sm font-bold tracking-wide text-white">Cage</span>
            <span className="rounded-full border border-white/15 bg-white/8 px-2 py-0.5 text-[10px] text-cyan-200">
              {release?.tagName ?? 'OSS · MIT'}
            </span>
          </a>

          <nav className="hidden items-center gap-6 text-xs text-slate-300 md:flex">
            <a href="#demo" className="transition hover:text-white">
              インタラクティブ体験
            </a>
            <a href="#features" className="transition hover:text-white">
              安全装置
            </a>
            <a href="#hybrid" className="transition hover:text-white">
              ローカル × 隔離VM
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <a
              href={repoUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/15"
            >
              <Github className="h-3.5 w-3.5" />
              GitHub
            </a>
            <a
              href={releasesUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 transition hover:brightness-110"
            >
              <Download className="h-3.5 w-3.5" />
              無料ダウンロード
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3.5 py-1 text-xs font-medium text-cyan-200">
          <Sparkles className="h-3.5 w-3.5" />
          Tauri v2 · 超軽量デスクトップAIエージェントGUI
        </div>

        <h1 className="mx-auto mt-6 max-w-4xl bg-gradient-to-b from-white via-cyan-50 to-slate-300 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-6xl sm:leading-[1.12]">
          透明なガラスの檻で、
          <br />
          自律AIエージェントを安全に。
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-slate-300/85 sm:text-base">
          ターミナルもYAML編集も、API課金の恐怖もいりません。Ollama / LM Studio を自動検知し、
          <strong className="text-white">Rust 物理安全境界</strong>と
          <strong className="text-white">ワンクリック隔離クラウドVM</strong>
          で、初心者でも安心して使えるオープンソースAIデスクトップクライアント。
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={release?.macArmUrl ?? releasesUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-400 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-[0_12px_36px_rgba(56,189,248,0.35)] transition hover:brightness-110"
          >
            <Download className="h-4 w-4" />
            macOS 版をダウンロード (.dmg)
          </a>
          <a
            href={release?.winUrl ?? releasesUrl}
            target="_blank"
            rel="noreferrer"
            className="glass-tile flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/12"
          >
            <Download className="h-4 w-4 text-cyan-300" />
            Windows 版 (.msi / .exe)
          </a>
          <a
            href="#demo"
            className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium text-cyan-200 transition hover:text-white"
          >
            ブラウザで体験する <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        {/* Interactive Demo */}
        <div id="demo" className="mx-auto mt-14 max-w-5xl text-left">
          <div className="mb-3 flex items-center justify-between px-1 text-xs text-slate-400">
            <span>↓ 実際の「承認ゲート」「パストラバーサル遮断」「隔離VM切替」をその場でクリック体験できます</span>
            <span className="hidden sm:inline">メモリ消費 ~45MB · Rust + React</span>
          </div>
          <InteractiveDemo />
        </div>
      </section>

      {/* Core 4 Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            「ガワ替え」ではない、安全装置としてのGUI
          </h2>
          <p className="mt-2 text-sm text-slate-300/80">
            ローカルLLMの弱点を、Rustの強制サンドボックスと視覚的な承認UIで補完します。
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <FeatureCard
            icon={<Wifi className="h-5 w-5 text-cyan-300" />}
            title="ローカルLLM自動検知（課金ゼロ）"
            desc="起動時に localhost:11434 (Ollama) や :1234 (LM Studio) を並列スキャン。緑ランプをクリックするだけで接続完了。もちろんOpenAI互換APIも利用可能。"
          />
          <FeatureCard
            icon={<Lock className="h-5 w-5 text-emerald-300" />}
            title="Rust物理安全境界 & ワンタイム承認トークン"
            desc="JS側の制限だけでなく Rust コアでパストラバーサルとシンボリックリンク脱出を物理遮断。危険操作は人間の承認ボタンで発行される1回限りのトークンなしでは実行不可。"
          />
          <FeatureCard
            icon={<Monitor className="h-5 w-5 text-violet-300" />}
            title="トグル1つで隔離クラウドVM (E2B Desktop)"
            desc="ブラウザ自律巡回や危険な検証は、スイッチ1つでクラウド上の隔離Linuxデスクトップへ逃がして実行。ライブ映像を見守りつつ、いつでも人間が横取り操作可能。"
          />
          <FeatureCard
            icon={<Cpu className="h-5 w-5 text-sky-300" />}
            title="ローカルLLMのVRAMを奪わない Tauri v2"
            desc="Electron のように Chromium を抱え込まないため常駐メモリは最小限。ローカルLLMのために大切なユニファイドメモリを温存できます。"
          />
        </div>
      </section>

      {/* Hybrid Mode Comparison */}
      <section id="hybrid" className="mx-auto max-w-5xl px-4 py-12">
        <div className="glass-surface grid gap-6 rounded-3xl p-8 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-300/25 bg-emerald-400/8 p-6">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-200">
              <ShieldCheck className="h-5 w-5" />
              Local Mode（日常の作業）
            </div>
            <ul className="mt-4 space-y-2.5 text-xs leading-relaxed text-slate-200">
              <li>• Ollama / LM Studio で完全無料・完全オフライン動作</li>
              <li>• 指定した「許可フォルダ」内だけを安全に読み書き</li>
              <li>• ファイル削除やシェル実行は承認ゲートで確実に一時停止</li>
              <li>• すべての実行履歴を Rust 監査ログに自動記録</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-violet-300/25 bg-violet-400/10 p-6">
            <div className="flex items-center gap-2 text-sm font-bold text-violet-200">
              <FolderLock className="h-5 w-5" />
              Isolated VM Mode（危険作業・Computer Use）
            </div>
            <ul className="mt-4 space-y-2.5 text-xs leading-relaxed text-slate-200">
              <li>• E2B Desktop で数秒で使い捨てLinuxデスクトップを起動</li>
              <li>• ホストPCのファイルには一切アクセスできない完全隔離</li>
              <li>• アプリ右ペインに noVNC ライブ映像を埋め込み表示</li>
              <li>• 「手動操作（Takeover）」で人間がいつでも直接操作に介入</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-4 pb-12 pt-8 text-center text-xs text-slate-400">
        <div className="border-t border-white/10 pt-8">
          <p className="font-medium text-slate-300">
            Cage — Open Source Local-First AI Agent Desktop (MIT License)
          </p>
          <p className="mt-1.5">
            Built with Tauri v2 · Rust · React · TypeScript · E2B Desktop
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="glass-tile rounded-2xl p-6">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/8">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-xs leading-relaxed text-slate-300/85">{desc}</p>
    </div>
  );
}
