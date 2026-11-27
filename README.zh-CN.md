<div align="center">

# Cage

**在透明的玻璃沙盒中，安全运行自主本地 AI 智能体。**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-38bdf8?style=flat-square)](https://latencius.github.io/cage/?lang=zh)
[![License: MIT](https://img.shields.io/badge/License-MIT-34d399?style=flat-square)](./LICENSE)
[![Built with Tauri v2](https://img.shields.io/badge/Tauri-v2-a78bfa?style=flat-square)](https://v2.tauri.app/)

[English](./README.md) | [日本語](./README.ja.md) | **简体中文**

</div>

---

**Cage** 是一款基于 **Tauri v2** 构建的超轻量级自主 AI 智能体桌面客户端，聚焦于本地大模型零配置接入、**Rust 物理级安全边界** 以及 **一键切换 E2B 云端隔离桌面虚拟机（Computer Use）**。

## 核心特性

- **零配置自动发现本地 LLM**：启动时自动扫描 `Ollama (:11434)`、`LM Studio (:1234)`、`llama.cpp (:8080)` 与 `vLLM (:8000)`，一键直连、零 API 费用、完全离线运行，同时也兼容任意 OpenAI 格式接口。
- **Rust 强制执行的物理安全边界**：
  - 在 Rust 层对所有路径做规范化校验，彻底拦截 `..` 路径穿越与符号链接逃逸
  - 删除文件、写入文件、执行 Shell 等高风险操作必须通过人工审批网关签发的**参数绑定一次性令牌**方可放行
  - 自动记录所有工具调用审计日志
- **Local 🟢 / Isolated VM 🛡️ 一键混合切换**：
  - 日常任务在本地授权目录中免费高速执行
  - 高风险操作或浏览器自动巡检可一键切换至 **E2B Desktop** 一次性云端 Ubuntu 虚拟机，应用内嵌 noVNC 实时画面，并支持随时点击 **人工接管（Takeover）** 介入操作
- **MCP (Model Context Protocol) 扩展**：支持 `stdio` 与 `Streamable HTTP` MCP 服务器，所有外部 MCP 工具调用同样经过 Rust 一次性审批令牌保护。
- **OpenClaw Gateway 连接 (WebSocket v4)**：支持探测 `ws://127.0.0.1:18789`、`connect.challenge` → `hello-ok` 握手、实时事件流与人工审批拦截。
- **超轻量 Tauri v2 与毛玻璃 UI**：
  - macOS `.dmg` 仅约 4.8 MiB，不占用宝贵的统一内存与显存，为本地模型留出充足空间。

## 仓库结构

```text
.
├── apps/
│   ├── desktop/            # Tauri v2 + React 19 + Tailwind CSS v4 + Rust 安全边界
│   └── web/                # 多语言官网与交互式演示 (GitHub Pages)
├── packages/
│   └── agent-core/         # 共享智能体执行引擎、混合工具解析器与 E2B 控制层
└── .github/workflows/
    ├── ci.yml              # TypeScript 类型检查、单元测试与 Rust 安全测试
    ├── pages.yml           # 自动部署多语言官网至 GitHub Pages
    └── release.yml         # 推送 v* 标签自动构建 macOS (arm64/x64) 与 Windows 安装包
```

## 本地开发

```bash
npm install
npm run test:core
(cd apps/desktop/src-tauri && cargo test)
npm run dev:desktop
npm run dev:web
```

## 开源协议

[MIT](./LICENSE)
