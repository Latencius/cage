export type Locale = 'en' | 'ja' | 'zh';

export const LOCALE_OPTIONS: Array<{ code: Locale; label: string }> = [
  { code: 'en', label: 'EN' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
];

const STORAGE_KEY = 'cage.web.locale.v1';

export function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  const param = new URLSearchParams(window.location.search).get('lang')?.toLowerCase();
  if (param === 'en' || param === 'ja' || param === 'zh') return param;
  if (param === 'zh-cn') return 'zh';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'ja' || saved === 'zh') return saved;
  } catch {
    // ignore
  }
  return 'en';
}

export function persistLocale(locale: Locale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // ignore
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : locale;
  }
}

export interface WebMessages {
  pageTitle: string;
  navDemo: string;
  navFeatures: string;
  navHybrid: string;
  downloadFree: string;
  heroBadge: string;
  heroTitleLine1: string;
  heroTitleLine2: string;
  heroDescPrefix: string;
  heroDescStrong1: string;
  heroDescMid: string;
  heroDescStrong2: string;
  heroDescSuffix: string;
  downloadMac: string;
  downloadWin: string;
  tryInBrowser: string;
  demoHintLeft: string;
  demoHintRight: string;
  featuresTitle: string;
  featuresSubtitle: string;
  feat1Title: string;
  feat1Desc: string;
  feat2Title: string;
  feat2Desc: string;
  feat3Title: string;
  feat3Desc: string;
  feat4Title: string;
  feat4Desc: string;
  localModeTitle: string;
  localModeBullets: string[];
  vmModeTitle: string;
  vmModeBullets: string[];
  footerTitle: string;
  footerSub: string;
  starPrompt: {
    badge: string;
    title: string;
    desc: string;
    cta: string;
    later: string;
    never: string;
  };
  demo: {
    localLabel: string;
    vmLabel: string;
    allowedFolder: string;
    localBlocked: string;
    btnApprovalTest: string;
    btnEscapeTest: string;
    initialLog1: string;
    initialLog2: string;
    initialSummary: string;
    shellSummary: string;
    approvedLog: (tool: string) => string;
    deniedLog: (tool: string) => string;
    blockedEscapeLog: string;
    approvalHeader: string;
    denyBtn: string;
    approveBtn: string;
    takeoverActive: string;
    watchMode: string;
    vmStreamActive: string;
    vmTakeoverHint: string;
    vmWatchHint: string;
    vmIsolatedHost: string;
    vmEphemeral: string;
  };
}

export const WEB_MESSAGES: Record<Locale, WebMessages> = {
  en: {
    pageTitle: 'Cage — A Transparent Glass Cage for Local AI Agents',
    navDemo: 'Live Demo',
    navFeatures: 'Safety',
    navHybrid: 'Local × Isolated VM',
    downloadFree: 'Download Free',
    heroBadge: 'Tauri v2 · Ultra-Lightweight Local AI Agent GUI',
    heroTitleLine1: 'A transparent glass cage',
    heroTitleLine2: 'for autonomous AI agents.',
    heroDescPrefix:
      'No terminal setup, no YAML configs, and zero surprise API bills. Auto-detects Ollama & LM Studio with a ',
    heroDescStrong1: 'Rust-enforced security boundary',
    heroDescMid: ' and ',
    heroDescStrong2: 'one-toggle isolated cloud VM',
    heroDescSuffix: ' — open-source peace of mind for everyone.',
    downloadMac: 'Download for macOS (.dmg)',
    downloadWin: 'Windows (.msi / .exe)',
    tryInBrowser: 'Try interactive demo',
    demoHintLeft: '↓ Click to test the Approval Gate, Traversal Block, and Isolated VM switch right here',
    demoHintRight: '~4.8 MiB installer · Rust + React',
    featuresTitle: 'Not just a pretty wrapper — a real safety device',
    featuresSubtitle:
      'Compensate for local LLM unpredictability with Rust-level sandboxing and crystal-clear human approvals.',
    feat1Title: 'Zero-Config Local LLM Discovery',
    feat1Desc:
      'Parallel-scans Ollama (:11434), LM Studio (:1234), llama.cpp (:8080), and vLLM (:8000) on launch. Connect in one click with zero API fees — or bring any OpenAI-compatible API.',
    feat2Title: 'Rust Security Boundary & One-Time Tokens',
    feat2Desc:
      'Path traversal (..) and symlink escapes are physically blocked in Rust. Destructive actions require a single-use, argument-bound token minted only when you click Approve.',
    feat3Title: 'One-Toggle Isolated Cloud VM (E2B Desktop)',
    feat3Desc:
      'Offload risky web browsing or Computer Use to a disposable Ubuntu desktop VM in one click. Watch live noVNC video inside Cage and hit Takeover whenever you want control.',
    feat4Title: 'Built with Tauri v2 to Preserve Your VRAM',
    feat4Desc:
      'Unlike Electron apps bundling Chromium, Cage uses your OS native WebView — leaving unified memory and VRAM free for your local models.',
    localModeTitle: 'Local Mode (Everyday Work)',
    localModeBullets: [
      '100% free & offline with Ollama or LM Studio',
      'Strictly confined to the workspace folders you allow',
      'Deletes and shell commands pause at the Approval Gate',
      'Every tool invocation is logged in the Rust audit trail',
    ],
    vmModeTitle: 'Isolated VM Mode (Risky Tasks & Computer Use)',
    vmModeBullets: [
      'Spins up a disposable E2B Ubuntu desktop in seconds',
      'Zero access to your host Mac or Windows filesystem',
      'Live embedded noVNC stream right inside the app',
      'One-click Human Takeover for logins or manual intervention',
    ],
    footerTitle: 'Cage — Open Source Local-First AI Agent Desktop (MIT License)',
    footerSub: 'Built with Tauri v2 · Rust · React · TypeScript · E2B Desktop',
    starPrompt: {
      badge: 'Open Source · MIT',
      title: 'Like the idea behind Cage?',
      desc: 'Give us a star on GitHub to follow releases and help other local-AI builders discover it.',
      cta: 'Star on GitHub',
      later: 'Later',
      never: "Don't show again",
    },
    demo: {
      localLabel: 'Local Mode',
      vmLabel: 'Isolated VM',
      allowedFolder: 'Allowed folder: ~/CageWorkspace',
      localBlocked: 'Host filesystem completely isolated',
      btnApprovalTest: '+ Approval Test',
      btnEscapeTest: '+ Traversal Attack',
      initialLog1: 'Auto-detected Ollama (:11434) → connected qwen2.5-coder:14b (12ms)',
      initialLog2: 'list_dir(".") → auto-allowed inside workspace (8 items)',
      initialSummary: 'Delete old invoice PDF: ~/CageWorkspace/old-draft-2025.pdf',
      shellSummary: 'Run shell command: ls -la && du -sh .',
      approvedLog: (tool) => `One-time token issued → executed ${tool} safely`,
      deniedLog: (tool) => `Denied by operator → aborted ${tool} and notified agent`,
      blockedEscapeLog:
        'Rust boundary blocked read_file("../../etc/passwd"): outside allowed folders',
      approvalHeader: 'HUMAN APPROVAL REQUIRED — EXECUTION PAUSED',
      denyBtn: 'Deny',
      approveBtn: 'Approve Once',
      takeoverActive: 'Takeover Active',
      watchMode: 'Watch Mode',
      vmStreamActive: '[Isolated Stream Active] 1280×800 · Encrypted noVNC WebSocket',
      vmTakeoverHint: '→ Human mouse & keyboard input enabled (great for logins / CAPTCHAs)',
      vmWatchHint: '→ Agent operating autonomously. Click Takeover anytime to intervene.',
      vmIsolatedHost: 'Completely isolated from host OS',
      vmEphemeral: 'VM destroyed on session end',
    },
  },
  ja: {
    pageTitle: 'Cage — 透明なガラスの檻で、ローカルAIエージェントを安全に。',
    navDemo: 'インタラクティブ体験',
    navFeatures: '安全装置',
    navHybrid: 'ローカル × 隔離VM',
    downloadFree: '無料ダウンロード',
    heroBadge: 'Tauri v2 · 超軽量デスクトップAIエージェントGUI',
    heroTitleLine1: '透明なガラスの檻で、',
    heroTitleLine2: '自律AIエージェントを安全に。',
    heroDescPrefix:
      'ターミナルもYAML編集も、API課金の恐怖もいりません。Ollama / LM Studio を自動検知し、',
    heroDescStrong1: 'Rust 物理安全境界',
    heroDescMid: 'と',
    heroDescStrong2: 'ワンクリック隔離クラウドVM',
    heroDescSuffix: 'で、初心者でも安心して使えるオープンソースAIデスクトップクライアント。',
    downloadMac: 'macOS 版をダウンロード (.dmg)',
    downloadWin: 'Windows 版 (.msi / .exe)',
    tryInBrowser: 'ブラウザで体験する',
    demoHintLeft: '↓ 実際の「承認ゲート」「パストラバーサル遮断」「隔離VM切替」をその場でクリック体験できます',
    demoHintRight: 'インストーラー約4.8MB · Rust + React',
    featuresTitle: '「ガワ替え」ではない、安全装置としてのGUI',
    featuresSubtitle:
      'ローカルLLMの弱点を、Rustの強制サンドボックスと視覚的な承認UIで補完します。',
    feat1Title: 'ローカルLLM自動検知（課金ゼロ）',
    feat1Desc:
      '起動時に Ollama (:11434) や LM Studio (:1234) を並列スキャン。緑ランプをクリックするだけで接続完了。もちろんOpenAI互換APIも利用可能。',
    feat2Title: 'Rust物理安全境界 & ワンタイム承認トークン',
    feat2Desc:
      'JS側の制限だけでなく Rust コアでパストラバーサルとシンボリックリンク脱出を物理遮断。危険操作は人間の承認ボタンで発行される1回限りのトークンなしでは実行不可。',
    feat3Title: 'トグル1つで隔離クラウドVM (E2B Desktop)',
    feat3Desc:
      'ブラウザ自律巡回や危険な検証は、スイッチ1つでクラウド上の隔離Linuxデスクトップへ逃がして実行。ライブ映像を見守りつつ、いつでも人間が横取り操作可能。',
    feat4Title: 'ローカルLLMのVRAMを奪わない Tauri v2',
    feat4Desc:
      'Electron のように Chromium を抱え込まないため常駐メモリは最小限。ローカルLLMのために大切なユニファイドメモリを温存できます。',
    localModeTitle: 'Local Mode（日常の作業）',
    localModeBullets: [
      'Ollama / LM Studio で完全無料・完全オフライン動作',
      '指定した「許可フォルダ」内だけを安全に読み書き',
      'ファイル削除やシェル実行は承認ゲートで確実に一時停止',
      'すべての実行履歴を Rust 監査ログに自動記録',
    ],
    vmModeTitle: 'Isolated VM Mode（危険作業・Computer Use）',
    vmModeBullets: [
      'E2B Desktop で数秒で使い捨てLinuxデスクトップを起動',
      'ホストPCのファイルには一切アクセスできない完全隔離',
      'アプリ右ペインに noVNC ライブ映像を埋め込み表示',
      '「手動操作（Takeover）」で人間がいつでも直接操作に介入',
    ],
    footerTitle: 'Cage — Open Source Local-First AI Agent Desktop (MIT License)',
    footerSub: 'Built with Tauri v2 · Rust · React · TypeScript · E2B Desktop',
    starPrompt: {
      badge: 'オープンソース · MIT',
      title: 'Cage を気に入っていただけましたか？',
      desc: 'GitHub でスターをつけて応援してもらえると、アップデート通知や開発の大きな励みになります！',
      cta: 'GitHub でスターをつける',
      later: 'あとで',
      never: '今後表示しない',
    },
    demo: {
      localLabel: 'Local Mode',
      vmLabel: '隔離VM Mode',
      allowedFolder: '許可フォルダ: ~/CageWorkspace',
      localBlocked: 'ローカルファイル完全遮断中',
      btnApprovalTest: '+ 承認テスト',
      btnEscapeTest: '+ 脱出アタック試行',
      initialLog1: 'Ollama (:11434) 自動検知 → qwen2.5-coder:14b 接続完了 (12ms)',
      initialLog2: 'list_dir(".") → 自動許可（許可フォルダ内）で 8 件取得',
      initialSummary: '古い請求書PDFを削除: ~/CageWorkspace/old-draft-2025.pdf',
      shellSummary: 'シェルコマンド実行: ls -la && du -sh .',
      approvedLog: (tool) => `ワンタイムトークン発行 → ${tool} を安全に実行完了`,
      deniedLog: (tool) => `ユーザーが拒否 → ${tool} を中止しエージェントへ通知`,
      blockedEscapeLog:
        'Rust境界が遮断: read_file("../../etc/passwd") は許可フォルダ外のため物理ブロック',
      approvalHeader: 'HUMAN APPROVAL REQUIRED — 実行一時停止中',
      denyBtn: '拒否する',
      approveBtn: '今回のみ許可',
      takeoverActive: '手動操作中',
      watchMode: '監視モード',
      vmStreamActive: '[Isolated Stream Active] 1280×800 · Encrypted noVNC WebSocket',
      vmTakeoverHint: '→ 人間のマウス/キーボード入力が有効です（ログイン・CAPTCHA対応可）',
      vmWatchHint: '→ エージェントが自律操作中。いつでも「手動操作」で横取りできます',
      vmIsolatedHost: 'ホストMac/Windowsから完全隔離',
      vmEphemeral: 'セッション終了時にVM破棄',
    },
  },
  zh: {
    pageTitle: 'Cage — 在透明玻璃沙盒中安全运行本地 AI 智能体',
    navDemo: '在线交互体验',
    navFeatures: '安全机制',
    navHybrid: '本地 × 隔离虚拟机',
    downloadFree: '免费下载',
    heroBadge: 'Tauri v2 · 超轻量本地 AI 智能体桌面端',
    heroTitleLine1: '在透明的玻璃沙盒中，',
    heroTitleLine2: '安全驾驭自主 AI 智能体。',
    heroDescPrefix:
      '无需命令行、无需编辑 YAML、更无 API 账单焦虑。自动发现本地 Ollama / LM Studio，结合 ',
    heroDescStrong1: 'Rust 物理安全边界',
    heroDescMid: ' 与 ',
    heroDescStrong2: '一键云端隔离桌面 VM',
    heroDescSuffix: '，让每个人都能安心使用开源自主智能体。',
    downloadMac: '下载 macOS 版 (.dmg)',
    downloadWin: '下载 Windows 版 (.msi / .exe)',
    tryInBrowser: '立即在线体验',
    demoHintLeft: '↓ 直接点击体验「人工审批网关」「路径穿越拦截」与「云端隔离 VM 切换」',
    demoHintRight: '安装包仅 ~4.8 MiB · Rust + React',
    featuresTitle: '不只是换壳，而是为本地 AI 打造的安全装置',
    featuresSubtitle:
      '用 Rust 强制沙盒与可视化人工审批，补齐本地小模型在工具调用上的不确定性。',
    feat1Title: '零配置自动发现本地 LLM（零费用）',
    feat1Desc:
      '启动时并发扫描 Ollama (:11434)、LM Studio (:1234)、llama.cpp 与 vLLM，一键直连离线运行；同时也支持任意 OpenAI 兼容 API。',
    feat2Title: 'Rust 物理安全边界 & 一次性审批令牌',
    feat2Desc:
      '在 Rust 底层物理阻断 .. 路径穿越与符号链接逃逸。删除文件和执行 Shell 必须由人工点击批准并签发绑定参数的一次性令牌后才可执行。',
    feat3Title: '一键切换隔离云端桌面 (E2B Desktop)',
    feat3Desc:
      '高风险网页巡检或 Computer Use 一键切至云端一次性 Ubuntu 桌面。应用内嵌 noVNC 实时画面，随时点击人工接管（Takeover）。',
    feat4Title: '基于 Tauri v2，不抢占本地模型显存',
    feat4Desc:
      '无需捆绑臃肿的 Chromium，常驻内存占用极低，把宝贵的统一内存和显存全部留给本地大模型。',
    localModeTitle: 'Local Mode（日常本地工作）',
    localModeBullets: [
      '直连 Ollama / LM Studio，完全免费且离线可用',
      '严格限定在用户显式授权的目录内读写',
      '文件删除与终端命令必经审批网关暂停确认',
      '所有调用自动记录至 Rust 安全审计日志',
    ],
    vmModeTitle: 'Isolated VM Mode（高风险任务 & Computer Use）',
    vmModeBullets: [
      '数秒内拉起一次性 E2B 云端 Ubuntu 桌面',
      '与本机 Mac / Windows 文件系统完全物理隔离',
      '应用右侧直接嵌入 noVNC 实时桌面画面',
      '支持一键人工接管（Takeover）处理登录或验证码',
    ],
    footerTitle: 'Cage — Open Source Local-First AI Agent Desktop (MIT License)',
    footerSub: 'Built with Tauri v2 · Rust · React · TypeScript · E2B Desktop',
    starPrompt: {
      badge: '开源项目 · MIT',
      title: '喜欢 Cage 的设计理念吗？',
      desc: '欢迎在 GitHub 上点亮 Star 支持项目，帮助更多本地 AI 开发者发现它！',
      cta: '去 GitHub 点 Star',
      later: '稍后再说',
      never: '不再提示',
    },
    demo: {
      localLabel: 'Local Mode',
      vmLabel: '隔离 VM 模式',
      allowedFolder: '授权目录: ~/CageWorkspace',
      localBlocked: '宿主机文件系统已完全隔离',
      btnApprovalTest: '+ 审批测试',
      btnEscapeTest: '+ 模拟逃逸攻击',
      initialLog1: '自动发现 Ollama (:11434) → 已连接 qwen2.5-coder:14b (12ms)',
      initialLog2: 'list_dir(".") → 授权目录内自动放行（共 8 项）',
      initialSummary: '删除旧发票 PDF: ~/CageWorkspace/old-draft-2025.pdf',
      shellSummary: '执行 Shell 命令: ls -la && du -sh .',
      approvedLog: (tool) => `已签发一次性令牌 → 安全执行 ${tool} 完成`,
      deniedLog: (tool) => `用户已拒绝 → 中止 ${tool} 并通知智能体`,
      blockedEscapeLog:
        'Rust 安全边界拦截: read_file("../../etc/passwd") 超出授权目录已被物理阻断',
      approvalHeader: 'HUMAN APPROVAL REQUIRED — 等待人工审批',
      denyBtn: '拒绝',
      approveBtn: '仅本次允许',
      takeoverActive: '人工接管中',
      watchMode: '监控模式',
      vmStreamActive: '[Isolated Stream Active] 1280×800 · Encrypted noVNC WebSocket',
      vmTakeoverHint: '→ 已启用人工键鼠输入（可直接登录或处理验证码）',
      vmWatchHint: '→ 智能体正在隔离桌面自主操作，随时可点击接管',
      vmIsolatedHost: '与宿主机系统完全隔离',
      vmEphemeral: '会话结束自动销毁 VM',
    },
  },
};
