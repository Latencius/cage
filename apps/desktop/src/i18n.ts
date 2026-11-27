import type { PermissionLevel, ToolCategory } from '@cage/agent-core';

export type Locale = 'en' | 'ja' | 'zh';

export const LOCALE_OPTIONS: Array<{ code: Locale; label: string }> = [
  { code: 'en', label: 'EN' },
  { code: 'ja', label: 'JA' },
  { code: 'zh', label: '中文' },
];

const STORAGE_KEY = 'cage.desktop.locale.v1';

export function getInitialLocale(): Locale {
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

export interface DesktopMessages {
  header: {
    demoActive: string;
    unselected: string;
    tabMission: string;
    tabSetup: string;
    tabSafety: string;
    modeLocal: string;
    modeVm: string;
    rustGuard: string;
  };
  mission: {
    localSafeMode: string;
    allowedFolder: (first: string, extra: number) => string;
    noAllowedFolder: string;
    vmBanner: string;
    clear: string;
    emptyTitle: string;
    emptyDesc: string;
    localPresets: string[];
    vmPresets: string[];
    runningText: string;
    placeholderLocal: string;
    placeholderVm: string;
    stop: string;
    run: string;
  };
  approval: {
    title: string;
    riskSuffix: string;
    tokenHint: string;
    deny: string;
    approveOnce: string;
  };
  vm: {
    header: string;
    takeoverActive: string;
    watchMode: string;
    stop: string;
    startingTitle: string;
    startingDesc: string;
    idleTitle: string;
    idleDesc: string;
    startBtn: string;
    setupKeyBtn: string;
  };
  setup: {
    badge: string;
    title: string;
    subtitle: string;
    scanning: string;
    rescan: string;
    toMission: string;
    localSectionTitle: string;
    useDemo: string;
    connected: string;
    connect: string;
    offline: string;
    customTitle: string;
    customDesc: string;
    apiKeyLabel: string;
    applyCustom: string;
    e2bTitle: string;
    e2bDesc: string;
    e2bHowTitle: string;
    e2bBullets: string[];
  };
  safety: {
    foldersTitle: string;
    foldersDesc: string;
    addFolder: string;
    noFoldersWarning: string;
    removeFolderTitle: string;
    matrixTitle: string;
    matrixDesc: string;
    levels: Record<PermissionLevel, string>;
    tools: Record<ToolCategory, { label: string; desc: string }>;
    auditTitle: (count: number) => string;
    clearAudit: string;
    noAudit: string;
  };
}

export const DESKTOP_MESSAGES: Record<Locale, DesktopMessages> = {
  en: {
    header: {
      demoActive: 'Demo Sandbox Active',
      unselected: 'No model',
      tabMission: 'Mission',
      tabSetup: 'Connections',
      tabSafety: 'Safety',
      modeLocal: 'Local',
      modeVm: 'Isolated VM',
      rustGuard: 'Rust Guard',
    },
    mission: {
      localSafeMode: 'Local Safe Mode',
      allowedFolder: (first, extra) =>
        `Allowed: ${first}${extra > 0 ? ` (+${extra})` : ''}`,
      noAllowedFolder: 'No allowed folder (click to add)',
      vmBanner: 'Isolated Cloud VM Mode — Host files unreachable',
      clear: 'Clear',
      emptyTitle: 'Run autonomous AI safely inside a transparent glass cage.',
      emptyDesc:
        'Every thought and tool call is streamed in real time, and risky operations pause at the Rust-enforced Approval Gate.',
      localPresets: [
        'List files in the allowed folder',
        'Create a report file cage-summary.md',
        'Run a shell check in the workspace',
        'Delete temp-draft.txt (approval test)',
      ],
      vmPresets: [
        'Capture a screenshot of the isolated VM',
        'Inspect environment inside the isolated VM',
      ],
      runningText: 'Agent running inside security boundary...',
      placeholderLocal: 'Ask Cage to work inside your allowed folder...',
      placeholderVm: 'Ask Cage to browse or execute inside the isolated VM...',
      stop: 'Stop',
      run: 'Run',
    },
    approval: {
      title: 'HUMAN APPROVAL REQUIRED',
      riskSuffix: 'risk',
      tokenHint:
        'Approving mints a single-use Rust execution token bound strictly to these arguments.',
      deny: 'Deny',
      approveOnce: 'Approve Once',
    },
    vm: {
      header: 'Isolated Cloud VM (E2B Desktop)',
      takeoverActive: 'Takeover Active',
      watchMode: 'Watch Mode',
      stop: 'Stop',
      startingTitle: 'Booting isolated Ubuntu desktop...',
      startingDesc:
        'Spinning up a disposable E2B sandbox completely separated from your local machine.',
      idleTitle: 'Disposable cloud desktop that never touches your PC',
      idleDesc:
        'Route risky browsing, Computer Use, or untrusted commands to a cloud VM and watch live video inside Cage.',
      startBtn: 'Launch Isolated VM',
      setupKeyBtn: 'Set E2B_API_KEY in Connections',
    },
    setup: {
      badge: 'Zero-Config Auto Discovery',
      title: 'Local LLM & Isolated VM Setup',
      subtitle:
        'Auto-detect running Ollama / LM Studio instances for one-click, zero-fee offline execution.',
      scanning: 'Scanning...',
      rescan: 'Rescan',
      toMission: 'Open Mission →',
      localSectionTitle: 'Auto-Detected Local LLMs (No API Key · Free)',
      useDemo: 'Use Offline Demo Mode',
      connected: 'Connected',
      connect: 'Connect',
      offline: 'Offline',
      customTitle: 'Custom OpenAI-Compatible Endpoint',
      customDesc: 'Connect to OpenAI, OpenRouter, Gemini OpenAI-compat, or remote Ollama.',
      apiKeyLabel: 'API Key (optional for local)',
      applyCustom: 'Use This Endpoint',
      e2bTitle: 'Isolated VM (E2B Desktop) API',
      e2bDesc:
        'Run risky browsing or Computer Use in a disposable cloud Linux VM isolated from your host PC.',
      e2bHowTitle: 'How Isolated Mode works:',
      e2bBullets: [
        'Toggle "Isolated VM" in the header to route tool calls to E2B Desktop',
        'Watch live noVNC desktop video embedded right inside Cage',
        'Click "Takeover" anytime to manually control the VM mouse & keyboard',
      ],
    },
    safety: {
      foldersTitle: 'Allowed Workspace Folders (Rust Physical Sandbox)',
      foldersDesc:
        'Local file operations are strictly limited to folders listed here. Path traversal (..) and symlink escapes are blocked in Rust.',
      addFolder: 'Add Folder',
      noFoldersWarning:
        'No allowed folders configured (deny-by-default safe state). Add a workspace folder to enable local file tools.',
      removeFolderTitle: 'Remove from allowed list',
      matrixTitle: 'Tool Permission Firewall',
      matrixDesc:
        'Categories set to "Require Approval" are physically locked in Rust until you approve each call.',
      levels: {
        auto_allow: 'Auto Allow',
        require_approval: 'Require Approval',
        deny: 'Deny',
      },
      tools: {
        fs_read: {
          label: 'File Read & Directory Listing',
          desc: 'Read files and list contents inside allowed folders',
        },
        fs_write: {
          label: 'File Write, Edit & Move',
          desc: 'Create, overwrite, or move files within allowed folders',
        },
        fs_delete: {
          label: 'File & Folder Deletion',
          desc: 'Permanent deletion inside allowed folders (approval recommended)',
        },
        shell_exec: {
          label: 'Shell Command Execution',
          desc: 'Run commands inside allowed folders (catastrophic commands always hard-blocked)',
        },
        web_fetch: {
          label: 'Web Fetch (HTTP GET)',
          desc: 'Retrieve public web pages or documents',
        },
        vm_control: {
          label: 'Isolated VM Control (Computer Use)',
          desc: 'Clicks, typing, app launches, and Bash inside the E2B cloud VM',
        },
      },
      auditTitle: (count) => `Rust Security Audit Log (${count} entries)`,
      clearAudit: 'Clear Log',
      noAudit: 'No tool executions recorded yet.',
    },
  },
  ja: {
    header: {
      demoActive: 'デモサンドボックス稼働中',
      unselected: '未選択',
      tabMission: 'ミッション',
      tabSetup: '接続設定',
      tabSafety: '安全装置',
      modeLocal: 'Local',
      modeVm: '隔離VM',
      rustGuard: 'Rust保護',
    },
    mission: {
      localSafeMode: 'Local Safe Mode',
      allowedFolder: (first, extra) =>
        `許可フォルダ: ${first}${extra > 0 ? ` (+${extra})` : ''}`,
      noAllowedFolder: '許可フォルダ未設定（クリックして指定）',
      vmBanner: 'Isolated Cloud VM Mode — ローカルファイル遮断中',
      clear: 'クリア',
      emptyTitle: '透明なガラスの檻の中で、安全にAIを動かす。',
      emptyDesc:
        'すべての思考とツール呼び出しがリアルタイムに可視化され、危険な操作は Rust の承認ゲートで確実に一時停止します。',
      localPresets: [
        '許可フォルダの中身を一覧表示して',
        '作業レポートを cage-summary.md に作成して',
        'シェルでカレントディレクトリを確認して',
        'temp-draft.txt を削除して（承認テスト）',
      ],
      vmPresets: [
        '隔離VMの画面をスクリーンショットして',
        '隔離VMで環境情報を確認して',
      ],
      runningText: 'エージェントが安全境界内で処理を実行中...',
      placeholderLocal: 'エージェントに指示を出す（例: 許可フォルダのファイルを整理して）',
      placeholderVm: '隔離VMに指示を出す（例: ブラウザで最新ニュースを調べてスクリーンショット）',
      stop: '停止',
      run: '実行',
    },
    approval: {
      title: 'HUMAN APPROVAL REQUIRED',
      riskSuffix: 'risk',
      tokenHint: '承認すると Rust 安全境界がこの引数専用のワンタイム実行トークンを発行します。',
      deny: '拒否する',
      approveOnce: '今回のみ許可',
    },
    vm: {
      header: '隔離クラウドVM (E2B Desktop)',
      takeoverActive: '手動操作中',
      watchMode: '監視モード',
      stop: '終了',
      startingTitle: '隔離Ubuntuデスクトップを起動中...',
      startingDesc:
        'あなたのPCから完全に分離されたE2BサンドボックスとnoVNC映像を確立しています',
      idleTitle: 'ローカルPCを一切汚さない隔離デスクトップ',
      idleDesc:
        'ブラウザ巡回や未知のコマンド検証などリスクのある操作は、ワンクリックでクラウド上の使い捨てVMに逃がして映像を見守れます。',
      startBtn: '隔離VMを起動する',
      setupKeyBtn: '接続設定で E2B_API_KEY を入力する',
    },
    setup: {
      badge: 'ゼロ設定オートディスカバリー',
      title: 'ローカルLLM・隔離VMの接続ウィザード',
      subtitle:
        '起動中の Ollama / LM Studio を自動検知してワンクリック接続。課金ゼロ＆完全オフラインで動かせます。',
      scanning: 'スキャン中...',
      rescan: '再スキャン',
      toMission: 'ミッション画面へ →',
      localSectionTitle: 'ローカルLLM自動検知（APIキー不要・無料）',
      useDemo: 'オフライン・デモモードを使用',
      connected: '接続中',
      connect: '接続する',
      offline: '未起動',
      customTitle: 'カスタム OpenAI互換エンドポイント',
      customDesc: 'OpenAI / OpenRouter / Gemini OpenAI互換 / リモートOllama等に接続できます。',
      apiKeyLabel: 'API Key（ローカルなら空欄可）',
      applyCustom: 'このエンドポイントを使用',
      e2bTitle: '隔離VM（E2B Desktop）API設定',
      e2bDesc:
        '危険なブラウザ巡回やComputer Useを自分のPCから完全隔離したクラウドLinux VMで実行します。',
      e2bHowTitle: '隔離モードの仕組み:',
      e2bBullets: [
        'ヘッダーの「隔離VM」トグルをONにするとE2B Desktopへ接続',
        'アプリ右ペインに仮想PCのライブ画面（noVNC）を埋め込み',
        '必要時は「手動操作（Takeover）」ボタンで人間が横取り操作可能',
      ],
    },
    safety: {
      foldersTitle: 'アクセス許可フォルダ（Rust物理サンドボックス）',
      foldersDesc:
        'ここに追加したフォルダ配下のみローカル操作を許可します。.. トラバーサルやシンボリックリンク脱出も Rust 層で遮断します。',
      addFolder: 'フォルダを追加',
      noFoldersWarning:
        '許可フォルダが未設定です（デフォルト安全状態）。ローカルファイル操作を使うには「フォルダを追加」から作業ディレクトリを1つ指定してください。',
      removeFolderTitle: '許可リストから削除',
      matrixTitle: 'ツール別・承認ファイアウォール設定',
      matrixDesc:
        '「毎回承認」に設定された操作は、あなたが承認ボタンを押すまで Rust バックエンドが物理的に実行をロックします。',
      levels: {
        auto_allow: '自動許可',
        require_approval: '毎回承認',
        deny: '禁止',
      },
      tools: {
        fs_read: {
          label: 'ファイル読み取り / 一覧',
          desc: '許可フォルダ内のファイル内容確認やディレクトリ一覧取得',
        },
        fs_write: {
          label: 'ファイル作成 / 編集 / 移動',
          desc: '許可フォルダ内への新規保存・上書き・リネーム',
        },
        fs_delete: {
          label: 'ファイル / フォルダ削除',
          desc: '復元困難な削除操作（常に承認必須を推奨）',
        },
        shell_exec: {
          label: 'シェルコマンド実行',
          desc: '許可フォルダをカレントにしてターミナルコマンドを実行（破壊コマンドはRustで常時禁止）',
        },
        web_fetch: {
          label: 'Webページ取得 (HTTP GET)',
          desc: '指定URLのテキスト・ドキュメントを取得',
        },
        vm_control: {
          label: '隔離VM操作 (Computer Use)',
          desc: 'E2BクラウドVM上での画面クリック・文字入力・アプリ起動・Bash実行',
        },
      },
      auditTitle: (count) => `Rust セキュリティ監査ログ（最新 ${count} 件）`,
      clearAudit: 'ログをクリア',
      noAudit: 'まだツール実行の監査履歴はありません。',
    },
  },
  zh: {
    header: {
      demoActive: '离线演示沙盒运行中',
      unselected: '未选择',
      tabMission: '任务控制台',
      tabSetup: '连接配置',
      tabSafety: '安全装置',
      modeLocal: '本地模式',
      modeVm: '隔离 VM',
      rustGuard: 'Rust 保护',
    },
    mission: {
      localSafeMode: 'Local Safe Mode',
      allowedFolder: (first, extra) =>
        `授权目录: ${first}${extra > 0 ? ` (+${extra})` : ''}`,
      noAllowedFolder: '未设置授权目录（点击添加）',
      vmBanner: 'Isolated Cloud VM Mode — 本机文件完全隔离',
      clear: '清空',
      emptyTitle: '在透明的玻璃沙盒中，安全运行自主 AI。',
      emptyDesc:
        '所有思考过程与工具调用均实时透明展示，高风险操作将在 Rust 审批网关强制暂停等待确认。',
      localPresets: [
        '列出授权目录中的文件',
        '创建报告文件 cage-summary.md',
        '在工作区执行 Shell 检查',
        '删除 temp-draft.txt（审批测试）',
      ],
      vmPresets: ['截取隔离虚拟机桌面画面', '查看隔离虚拟机系统环境'],
      runningText: '智能体正在安全边界内执行...',
      placeholderLocal: '向 Cage 下达任务（例如：整理授权目录中的文件）...',
      placeholderVm: '向隔离 VM 下达任务（例如：在浏览器中检索信息并截图）...',
      stop: '停止',
      run: '执行',
    },
    approval: {
      title: 'HUMAN APPROVAL REQUIRED',
      riskSuffix: 'risk',
      tokenHint: '点击允许后，Rust 安全边界将签发仅绑定当前参数的一次性执行令牌。',
      deny: '拒绝',
      approveOnce: '仅本次允许',
    },
    vm: {
      header: '云端隔离虚拟机 (E2B Desktop)',
      takeoverActive: '人工接管中',
      watchMode: '监控模式',
      stop: '关闭',
      startingTitle: '正在启动隔离 Ubuntu 桌面...',
      startingDesc: '正在创建与本机完全隔离的 E2B 沙盒并建立 noVNC 实时画面流',
      idleTitle: '绝不污染本机环境的一次性隔离桌面',
      idleDesc:
        '高风险网页巡检、Computer Use 或未知命令可一键放进云端虚拟机执行，并实时监控画面。',
      startBtn: '启动隔离 VM',
      setupKeyBtn: '前往连接配置填写 E2B_API_KEY',
    },
    setup: {
      badge: '零配置自动发现',
      title: '本地大模型与隔离 VM 连接向导',
      subtitle: '自动扫描本地运行的 Ollama / LM Studio，一键直连、零费用离线运行。',
      scanning: '扫描中...',
      rescan: '重新扫描',
      toMission: '进入任务控制台 →',
      localSectionTitle: '自动发现的本地 LLM（免 API Key · 免费）',
      useDemo: '使用离线演示模式',
      connected: '已连接',
      connect: '连接',
      offline: '未启动',
      customTitle: '自定义 OpenAI 兼容接口',
      customDesc: '支持连接 OpenAI、OpenRouter、Gemini 兼容接口或远程 Ollama。',
      apiKeyLabel: 'API Key（本地可留空）',
      applyCustom: '使用此接口',
      e2bTitle: '隔离 VM (E2B Desktop) API 配置',
      e2bDesc: '将高风险浏览器操作与 Computer Use 放入云端一次性 Linux 虚拟机中执行。',
      e2bHowTitle: '隔离模式工作原理：',
      e2bBullets: [
        '在顶部切换至「隔离 VM」即可将工具调用路由至 E2B Desktop',
        '右侧窗口直接嵌入虚拟桌面 noVNC 实时画面',
        '随时点击「人工接管」即可直接接管虚拟机鼠标与键盘',
      ],
    },
    safety: {
      foldersTitle: '授权工作目录（Rust 物理沙盒）',
      foldersDesc:
        '仅允许访问下方列表中的目录。Rust 底层将物理阻断 .. 路径穿越与符号链接逃逸。',
      addFolder: '添加目录',
      noFoldersWarning:
        '尚未配置授权目录（默认安全拒绝状态）。请点击「添加目录」选择一个工作区。',
      removeFolderTitle: '从授权列表移除',
      matrixTitle: '工具权限审批防火墙',
      matrixDesc: '设为「每次审批」的操作在您点击允许前将被 Rust 后端物理锁定。',
      levels: {
        auto_allow: '自动允许',
        require_approval: '每次审批',
        deny: '禁止',
      },
      tools: {
        fs_read: {
          label: '文件读取与目录浏览',
          desc: '读取授权目录内的文件内容与列表',
        },
        fs_write: {
          label: '文件写入、编辑与移动',
          desc: '在授权目录内新建、修改或移动文件',
        },
        fs_delete: {
          label: '文件与目录删除',
          desc: '永久删除操作（建议始终开启审批）',
        },
        shell_exec: {
          label: 'Shell 命令执行',
          desc: '在授权目录中运行终端命令（破坏性命令在 Rust 层永久拦截）',
        },
        web_fetch: {
          label: '网页抓取 (HTTP GET)',
          desc: '获取公开网页文本或文档内容',
        },
        vm_control: {
          label: '隔离 VM 控制 (Computer Use)',
          desc: '在 E2B 云端虚拟桌面中点击、输入、启动应用或运行 Bash',
        },
      },
      auditTitle: (count) => `Rust 安全审计日志（共 ${count} 条）`,
      clearAudit: '清空日志',
      noAudit: '暂无工具执行记录。',
    },
  },
};
