import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Cpu,
  Download,
  FolderLock,
  Github,
  Globe,
  Lock,
  Monitor,
  Shield,
  ShieldCheck,
  Sparkles,
  Wifi,
} from 'lucide-react';
import { InteractiveDemo } from './components/InteractiveDemo';
import {
  getInitialLocale,
  LOCALE_OPTIONS,
  persistLocale,
  WEB_MESSAGES,
  type Locale,
} from './i18n';

interface ReleaseInfo {
  tagName: string;
  htmlUrl: string;
  macArmUrl?: string;
  winUrl?: string;
}

const DEFAULT_REPO = 'Latencius/cage';

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
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const [release, setRelease] = useState<ReleaseInfo | null>(null);

  const t = WEB_MESSAGES[locale];

  useEffect(() => {
    persistLocale(locale);
    document.title = t.pageTitle;
  }, [locale, t.pageTitle]);

  useEffect(() => {
    fetch(`https://api.github.com/repos/${repo}/releases/latest`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.tag_name) return;
        const assets: Array<{ name: string; browser_download_url: string }> = data.assets ?? [];
        const macArm =
          assets.find((a) => a.name.endsWith('.dmg') && a.name.includes('aarch64')) ??
          assets.find((a) => a.name.endsWith('.dmg'));
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
        <div className="glass-surface flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-3">
          <a href="#" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/25 bg-gradient-to-br from-cyan-300/35 to-indigo-500/35">
              <Shield className="h-4 w-4 text-cyan-200" />
            </div>
            <span className="text-sm font-bold tracking-wide text-white">Cage</span>
            <span className="rounded-full border border-white/15 bg-white/8 px-2 py-0.5 text-[10px] text-cyan-200">
              {release?.tagName ?? 'OSS · MIT'}
            </span>
          </a>

          <nav className="hidden items-center gap-6 text-xs text-slate-300 lg:flex">
            <a href="#demo" className="transition hover:text-white">
              {t.navDemo}
            </a>
            <a href="#features" className="transition hover:text-white">
              {t.navFeatures}
            </a>
            <a href="#hybrid" className="transition hover:text-white">
              {t.navHybrid}
            </a>
          </nav>

          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <div
              className="flex items-center gap-0.5 rounded-xl border border-white/15 bg-white/8 p-0.5"
              role="group"
              aria-label="Language"
            >
              <Globe className="ml-1.5 mr-1 h-3 w-3 text-cyan-200/80" />
              {LOCALE_OPTIONS.map((opt) => (
                <button
                  key={opt.code}
                  onClick={() => setLocale(opt.code)}
                  className={`rounded-lg px-2 py-1 text-[11px] font-medium transition ${
                    locale === opt.code
                      ? 'bg-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <a
              href={repoUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 rounded-xl border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/15 sm:flex"
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
              {t.downloadFree}
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3.5 py-1 text-xs font-medium text-cyan-200">
          <Sparkles className="h-3.5 w-3.5" />
          {t.heroBadge}
        </div>

        <h1 className="mx-auto mt-6 max-w-4xl bg-gradient-to-b from-white via-cyan-50 to-slate-300 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-6xl sm:leading-[1.12]">
          {t.heroTitleLine1}
          <br />
          {t.heroTitleLine2}
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-slate-300/85 sm:text-base">
          {t.heroDescPrefix}
          <strong className="text-white">{t.heroDescStrong1}</strong>
          {t.heroDescMid}
          <strong className="text-white">{t.heroDescStrong2}</strong>
          {t.heroDescSuffix}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={release?.macArmUrl ?? releasesUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-400 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-[0_12px_36px_rgba(56,189,248,0.35)] transition hover:brightness-110"
          >
            <Download className="h-4 w-4" />
            {t.downloadMac}
          </a>
          <a
            href={release?.winUrl ?? releasesUrl}
            target="_blank"
            rel="noreferrer"
            className="glass-tile flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/12"
          >
            <Download className="h-4 w-4 text-cyan-300" />
            {t.downloadWin}
          </a>
          <a
            href="#demo"
            className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium text-cyan-200 transition hover:text-white"
          >
            {t.tryInBrowser} <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        {/* Interactive Demo */}
        <div id="demo" className="mx-auto mt-14 max-w-5xl text-left">
          <div className="mb-3 flex items-center justify-between px-1 text-xs text-slate-400">
            <span>{t.demoHintLeft}</span>
            <span className="hidden sm:inline">{t.demoHintRight}</span>
          </div>
          <InteractiveDemo t={t.demo} />
        </div>
      </section>

      {/* Core 4 Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">{t.featuresTitle}</h2>
          <p className="mt-2 text-sm text-slate-300/80">{t.featuresSubtitle}</p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <FeatureCard
            icon={<Wifi className="h-5 w-5 text-cyan-300" />}
            title={t.feat1Title}
            desc={t.feat1Desc}
          />
          <FeatureCard
            icon={<Lock className="h-5 w-5 text-emerald-300" />}
            title={t.feat2Title}
            desc={t.feat2Desc}
          />
          <FeatureCard
            icon={<Monitor className="h-5 w-5 text-violet-300" />}
            title={t.feat3Title}
            desc={t.feat3Desc}
          />
          <FeatureCard
            icon={<Cpu className="h-5 w-5 text-sky-300" />}
            title={t.feat4Title}
            desc={t.feat4Desc}
          />
        </div>
      </section>

      {/* Hybrid Mode Comparison */}
      <section id="hybrid" className="mx-auto max-w-5xl px-4 py-12">
        <div className="glass-surface grid gap-6 rounded-3xl p-8 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-300/25 bg-emerald-400/8 p-6">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-200">
              <ShieldCheck className="h-5 w-5" />
              {t.localModeTitle}
            </div>
            <ul className="mt-4 space-y-2.5 text-xs leading-relaxed text-slate-200">
              {t.localModeBullets.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-violet-300/25 bg-violet-400/10 p-6">
            <div className="flex items-center gap-2 text-sm font-bold text-violet-200">
              <FolderLock className="h-5 w-5" />
              {t.vmModeTitle}
            </div>
            <ul className="mt-4 space-y-2.5 text-xs leading-relaxed text-slate-200">
              {t.vmModeBullets.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-4 pb-12 pt-8 text-center text-xs text-slate-400">
        <div className="border-t border-white/10 pt-8">
          <p className="font-medium text-slate-300">{t.footerTitle}</p>
          <p className="mt-1.5">{t.footerSub}</p>
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
