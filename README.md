<div align="center">

# Cage

**A transparent glass cage for running autonomous local AI agents safely.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-38bdf8?style=flat-square)](https://latencius.github.io/cage/)
[![License: MIT](https://img.shields.io/badge/License-MIT-34d399?style=flat-square)](./LICENSE)
[![Built with Tauri v2](https://img.shields.io/badge/Tauri-v2-a78bfa?style=flat-square)](https://v2.tauri.app/)

**English** | [日本語](./README.ja.md) | [简体中文](./README.zh-CN.md)

</div>

---

**Cage** is an ultra-lightweight **Tauri v2** desktop GUI for autonomous AI agents designed around three principles:

1. **Zero-Config Local LLM Discovery**: Automatically scans `Ollama (:11434)`, `LM Studio (:1234)`, `llama.cpp (:8080)`, and `vLLM (:8000)` on startup for one-click, zero-cost, offline agent execution (plus any OpenAI-compatible API).
2. **Rust-Enforced Physical Security Boundary**: Safety isn't just a UI prompt. The Rust core canonicalizes every path to block `..` traversal and symlink escapes, and locks destructive/shell tools behind **argument-bound, single-use human approval tokens**.
3. **One-Toggle Isolated Cloud VM Mode (E2B Desktop)**: Flip a single switch in the header to route risky browsing or Computer Use tasks into a disposable cloud Ubuntu desktop via [E2B Desktop](https://e2b.dev/), complete with an embedded live noVNC stream and a **Human Takeover** toggle.

---

## Key Features

- **Glassmorphic Mission Control**: Real-time transparent timeline showing thoughts, tool invocations, approval gates, and outputs.
- **Human-in-the-Loop Approval Firewall**: Per-category permission matrix (`Auto Allow` / `Require Approval` / `Deny`) for file reads, writes, deletes, shell commands, web fetches, and VM control.
- **Small Local LLM Friendly**: Hybrid tool-call parser supporting both native OpenAI `tool_calls` and fenced JSON fallback for 8B–32B local models.
- **Offline Demo Sandbox Built-In**: Try the approval gate and timeline workflow right away even before installing Ollama or adding API keys.
- **Tiny Footprint**: ~4.8 MiB macOS `.dmg` installer and minimal RAM overhead so your unified memory / VRAM stays free for local LLMs.

## Repository Layout

```text
.
├── apps/
│   ├── desktop/            # Tauri v2 + React 19 + Tailwind CSS v4 + Rust security boundary
│   └── web/                # Multilingual Landing Page & Interactive Demo (GitHub Pages)
├── packages/
│   └── agent-core/         # Shared agent loop, hybrid tool parser, E2B Desktop controller
└── .github/workflows/
    ├── ci.yml              # TypeScript typecheck, unit tests, Rust security boundary tests
    ├── pages.yml           # Automatic GitHub Pages deployment for apps/web
    └── release.yml         # Automatic macOS (arm64/x64) & Windows builds on v* tags
```

## Quick Start (Local Development)

### Prerequisites
- Node.js 22+
- Rust (`rustup`) — required only when building the Tauri desktop app

### Commands
```bash
npm install

# Run Agent Core unit tests
npm run test:core

# Run Rust security boundary unit tests
cd apps/desktop/src-tauri && cargo test

# Start Tauri desktop app in dev mode
npm run dev:desktop

# Build desktop production bundle (.dmg / .app / .msi / .exe)
npm run build:desktop

# Start or build the multilingual landing page
npm run dev:web
npm run build:web
```

## Releasing

- Pushing to `main` automatically deploys the landing page to **GitHub Pages** (`https://latencius.github.io/cage/`).
- Pushing a version tag triggers `.github/workflows/release.yml` to build and publish macOS (Apple Silicon & Intel) and Windows installers to **GitHub Releases**:
  ```bash
  git tag v0.1.1
  git push origin v0.1.1
  ```

## License

[MIT](./LICENSE)
