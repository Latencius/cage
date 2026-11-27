<div align="center">

# Cage

**透明なガラスの檻で、自律AIエージェントを安全に。**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-38bdf8?style=flat-square)](https://latencius.github.io/cage/?lang=ja)
[![License: MIT](https://img.shields.io/badge/License-MIT-34d399?style=flat-square)](./LICENSE)
[![Built with Tauri v2](https://img.shields.io/badge/Tauri-v2-a78bfa?style=flat-square)](https://v2.tauri.app/)

[English](./README.md) | **日本語** | [简体中文](./README.zh-CN.md)

</div>

---

**Cage** は、ローカルLLM（Ollama / LM Studio / OpenAI互換）とのワンクリック接続、**Rust 物理安全境界（承認ゲート＆許可フォルダ制限）**、そして **E2B Desktop による隔離クラウドVM切替** を備えた超軽量 Tauri v2 デスクトップAIエージェントGUIです。

## 主な特徴

- **ゼロ設定ローカルLLM自動検知**: 起動時に `Ollama (:11434)` / `LM Studio (:1234)` / `llama.cpp (:8080)` / `vLLM (:8000)` を並列スキャンしてワンクリック接続。API課金ゼロ・完全オフラインで動作します。
- **Rust による物理的な安全境界**:
  - 許可フォルダ外へのパストラバーサル（`..`）やシンボリックリンク脱出を Rust 層で物理ブロック
  - 危険操作（ファイル書き込み・削除・シェル実行等）は人間の承認ボタンで発行される**引数バインド型ワンタイム実行トークン**なしでは実行不可
  - すべての実行履歴を Rust 監査ログに自動記録
- **Local 🟢 / Isolated VM 🛡️ ハイブリッド切替**:
  - 日常作業はローカル許可フォルダ内で無料＆高速に実行
  - ブラウザ自律巡回や危険な検証はトグル1つで **E2B Desktop** の使い捨てUbuntu VMに逃がし、アプリ内ライブ映像（noVNC）を見守りつつ必要時に「手動操作（Takeover）」で介入可能
- **超軽量 Tauri v2 & Liquid Glass UI**:
  - macOS `.dmg` 約 4.8 MiB。Electron のようにメモリを消費せず、ローカルLLMのためにユニファイドメモリ / VRAM を温存できます。

## リポジトリ構成

```text
.
├── apps/
│   ├── desktop/            # Tauri v2 + React 19 + Tailwind CSS v4 + Rust 安全境界
│   └── web/                # 多言語紹介LP + インタラクティブデモ (GitHub Pages)
├── packages/
│   └── agent-core/         # 共有エージェントループ・ハイブリッドツールパーサ・E2B連携
└── .github/workflows/
    ├── ci.yml              # 型チェック・TS/Rustユニットテスト
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

# デスクトップアプリ開発起動 / 本番ビルド
npm run dev:desktop
npm run build:desktop

# 多言語LP開発起動 / ビルド
npm run dev:web
npm run build:web
```

## ライセンス

[MIT](./LICENSE)
