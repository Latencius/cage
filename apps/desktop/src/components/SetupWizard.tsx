import { useState } from 'react';
import type { LlmConfig, LocalLlmEndpoint } from '@cage/agent-core';
import {
  CheckCircle2,
  Cloud,
  Cpu,
  KeyRound,
  RefreshCw,
  Server,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react';

interface SetupWizardProps {
  endpoints: LocalLlmEndpoint[];
  scanning: boolean;
  onRescan: () => void;
  llm: LlmConfig;
  onChangeLlm: (config: LlmConfig) => void;
  e2bApiKey: string;
  onChangeE2bApiKey: (key: string) => void;
  onDone: () => void;
}

export function SetupWizard({
  endpoints,
  scanning,
  onRescan,
  llm,
  onChangeLlm,
  e2bApiKey,
  onChangeE2bApiKey,
  onDone,
}: SetupWizardProps) {
  const [customUrl, setCustomUrl] = useState(llm.baseUrl || 'https://api.openai.com/v1');
  const [customKey, setCustomKey] = useState(llm.apiKey || '');
  const [customModel, setCustomModel] = useState(llm.model || 'gpt-4o-mini');

  const connectLocal = (ep: LocalLlmEndpoint, model?: string) => {
    onChangeLlm({
      providerName: ep.name,
      baseUrl: ep.baseUrl,
      apiKey: 'local-no-key',
      model: model ?? ep.models[0] ?? 'llama3.2',
      demoMode: false,
    });
  };

  const applyCustom = () => {
    onChangeLlm({
      providerName: 'OpenAI互換API',
      baseUrl: customUrl.trim(),
      apiKey: customKey.trim(),
      model: customModel.trim() || 'gpt-4o-mini',
      demoMode: false,
    });
  };

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-5 overflow-y-auto px-4 py-5">
      {/* Top Banner */}
      <div className="glass-panel flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2.5 py-0.5 text-[11px] font-medium text-cyan-200">
            <Wifi className="h-3 w-3" />
            ゼロ設定オートディスカバリー
          </span>
          <h2 className="mt-2 text-lg font-semibold text-white">
            ローカルLLM・隔離VMの接続ウィザード
          </h2>
          <p className="mt-0.5 text-xs text-slate-300/80">
            起動中の Ollama / LM Studio を自動検知してワンクリック接続。課金ゼロ＆完全オフラインで動かせます。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRescan}
            disabled={scanning}
            className="glass-pill flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium text-cyan-100 transition hover:bg-white/15 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'スキャン中...' : '再スキャン'}
          </button>
          <button
            onClick={onDone}
            className="rounded-xl bg-gradient-to-r from-cyan-400/85 to-sky-500/85 px-4 py-2 text-xs font-semibold text-slate-950 shadow-[0_6px_24px_rgba(56,189,248,0.35)] transition hover:brightness-110"
          >
            ミッション画面へ →
          </button>
        </div>
      </div>

      {/* Auto-detected Local LLMs */}
      <section className="glass-panel rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Server className="h-4 w-4 text-cyan-300" />
            ローカルLLM自動検知（APIキー不要・無料）
          </h3>
          <button
            onClick={() =>
              onChangeLlm({
                providerName: 'Offline Demo',
                baseUrl: '',
                apiKey: '',
                model: 'cage-demo-simulator',
                demoMode: true,
              })
            }
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
              llm.demoMode
                ? 'bg-emerald-400/25 text-emerald-100 ring-1 ring-emerald-300/40'
                : 'bg-white/8 text-slate-300 hover:bg-white/15'
            }`}
          >
            <Sparkles className="mr-1 inline h-3 w-3" />
            オフライン・デモモードを使用
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {endpoints.map((ep) => {
            const isSelected = !llm.demoMode && llm.baseUrl === ep.baseUrl;
            return (
              <div
                key={ep.id}
                className={`glass-card flex flex-col justify-between rounded-xl p-4 transition ${
                  isSelected ? 'ring-1 ring-cyan-300/60' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          ep.online
                            ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]'
                            : 'bg-slate-500/70'
                        }`}
                      />
                      <span className="text-sm font-semibold text-white">{ep.name}</span>
                      {ep.latencyMs !== null && (
                        <span className="text-[11px] text-emerald-300/90">{ep.latencyMs}ms</span>
                      )}
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-slate-400">{ep.baseUrl}</p>
                  </div>

                  {ep.online ? (
                    <button
                      onClick={() => connectLocal(ep)}
                      className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        isSelected
                          ? 'bg-emerald-400/25 text-emerald-100 ring-1 ring-emerald-300/40'
                          : 'bg-white/15 text-white hover:bg-white/25'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" /> 接続中
                        </>
                      ) : (
                        '接続する'
                      )}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 text-[11px] text-slate-400">
                      <WifiOff className="h-3 w-3" /> 未起動
                    </span>
                  )}
                </div>

                {ep.online && ep.models.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {ep.models.slice(0, 6).map((m) => (
                      <button
                        key={m}
                        onClick={() => connectLocal(ep, m)}
                        className={`rounded-md px-2 py-0.5 font-mono text-[11px] transition ${
                          isSelected && llm.model === m
                            ? 'bg-cyan-400/30 text-cyan-100 ring-1 ring-cyan-300/50'
                            : 'bg-white/8 text-slate-300 hover:bg-white/15'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Custom OpenAI-Compatible & E2B Desktop Key */}
      <div className="grid gap-5 md:grid-cols-2">
        <section className="glass-panel rounded-2xl p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Cpu className="h-4 w-4 text-sky-300" />
            カスタム OpenAI互換エンドポイント
          </h3>
          <p className="mt-1 text-xs text-slate-300/75">
            OpenAI / OpenRouter / Gemini OpenAI互換 / リモートOllama等に接続できます。
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-[11px] text-slate-300">Base URL</label>
              <input
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="glass-input w-full rounded-xl px-3 py-2 font-mono text-xs text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-300">Model</label>
              <input
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder="gpt-4o-mini / qwen2.5-coder:14b"
                className="glass-input w-full rounded-xl px-3 py-2 font-mono text-xs text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-300">API Key（ローカルなら空欄可）</label>
              <input
                type="password"
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
                placeholder="sk-..."
                className="glass-input w-full rounded-xl px-3 py-2 font-mono text-xs text-white"
              />
            </div>
            <button
              onClick={applyCustom}
              className="w-full rounded-xl border border-cyan-300/35 bg-cyan-400/20 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/30"
            >
              このエンドポイントを使用
            </button>
          </div>
        </section>

        <section className="glass-panel rounded-2xl p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Cloud className="h-4 w-4 text-violet-300" />
            隔離VM（E2B Desktop）API設定
          </h3>
          <p className="mt-1 text-xs text-slate-300/75">
            危険なブラウザ巡回やComputer Useを自分のPCから完全隔離したクラウドLinux VMで実行します。
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 flex items-center gap-1 text-[11px] text-slate-300">
                <KeyRound className="h-3 w-3 text-violet-300" />
                E2B_API_KEY
              </label>
              <input
                type="password"
                value={e2bApiKey}
                onChange={(e) => onChangeE2bApiKey(e.target.value)}
                placeholder="e2b_..."
                className="glass-input w-full rounded-xl px-3 py-2 font-mono text-xs text-white"
              />
            </div>
            <div className="rounded-xl border border-violet-300/20 bg-violet-400/8 p-3 text-[11px] leading-relaxed text-violet-100/85">
              <p className="font-semibold text-violet-200">隔離モードの仕組み:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-300">
                <li>ヘッダーの「隔離VM」トグルをONにするとE2B Desktopへ接続</li>
                <li>アプリ右ペインに仮想PCのライブ画面（noVNC）を埋め込み</li>
                <li>必要時は「手動操作（Takeover）」ボタンで人間が横取り操作可能</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
