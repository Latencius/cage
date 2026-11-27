# Cage

**透明なガラスの檻で、ローカルAIエージェントを安全に。**

Cage は、ローカルLLM（Ollama / LM Studio / OpenAI互換）とのワンクリック接続、**Rust 物理安全境界（承認ゲート＆許可フォルダ制限）**、そして **E2B Desktop による隔離クラウドVM切替** を備えた超軽量 Tauri v2 デスクトップAIエージェントGUIです。

## 主な特徴

- **ゼロ設定ローカルLLM自動検知**: 起動時に `localhost:11434` (Ollama) / `localhost:1234` (LM Studio) / `:8080` (llama.cpp) / `:8000` (vLLM) を並列スキャンし、ワンクリックで接続。API課金ゼロ・完全オフラインで動作。
- **Rust による物理的な安全境界**:
  - 許可フォルダ外へのパストラバーサル（`..`）やシンボリックリンク脱出を Rust 層で物理ブロック
  - 危険操作（ファイル書き込み/削除・シェル実行等）は GUI の承認ボタンで発行される**引数バインド型ワンタイム実行トークン**なしでは絶対に実行されない設計
  - すべてのツール呼び出しを監査ログに記録
- **Local 🟢 / Isolated VM 🛡️ ハイブリッド切替**:
  - 日常作業はローカル許可フォルダ内で無料＆高速に実行
  - 危険な操作やブラウザ自律巡回・Computer Use時はトグル1つで **E2B Desktop** の使い捨てUbuntu VMに切り替え、ライブ映像（noVNC）を見守りながら必要時に「手動操作（Takeover）」で介入可能
- **Liquid Glass デザイン & 超軽量バイナリ**:
  - Tauri v2 (Rust + OS標準WebView) により、ローカルLLMのメモリを圧迫せず軽快に常駐

## リポジトリ構成

```text
.
├── apps/
│   ├── desktop/            # Tauri v2 + React + Tailwind CSS v4 + Rust 安全境界
│   └── web/                # GitHub Pages 向け紹介LP + インタラクティブデモ
├── packages/
│   └── agent-core/         # 共有エージェントループ・ハイブリッドツールパーサ・E2B連携
└── .github/workflows/
    ├── ci.yml              # 型チェック・TS/Rustユニットテスト・ビルド検証
    ├── pages.yml           # apps/web の GitHub Pages 自動デプロイ
    └── release.yml         # v* タグによる macOS (arm64/x64) + Windows 自動ビルド＆リリース
```

## ローカル開発

### 前提条件
- Node.js 22+
- Rust (`rustup`) — Tauri デスクトップアプリのビルド時のみ必要

### コマンド
```bash
npm install

# ユニットテスト (Agent Core)
npm run test:core

# Rust 安全境界テスト
cd apps/desktop/src-tauri && cargo test

# デスクトップアプリ開発起動 (Tauri v2)
npm run dev:desktop

# デスクトップアプリ本番ビルド (.dmg / .app / .msi)
npm run build:desktop

# 紹介LP開発起動 / ビルド
npm run dev:web
npm run build:web
```

## リリース手順（自動ビルド＆配布）

1. `main` にプッシュすると GitHub Actions (`pages.yml`) が自動で **GitHub Pages** に紹介LPをデプロイします。
2. タグを打ってプッシュすると、`release.yml` が macOS (Apple Silicon / Intel) と Windows インストーラーを並列ビルドして **GitHub Releases** に公開します：
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

## License

MIT
