<div align="center">

# Hi-Agent

**像工程师一样，构建会思考的 AI Agent**

一门系统讲解 AI Agent 工程的文字课程 —— 从 Chat 协议到 Agent Loop，从 Tool 设计到 Context Engineering，再到 Memory、Multi-Agent 与 Harness。

[课程主页（GitHub Pages）](https://jaguarliuu.github.io/hi-agent) · [课程大纲](#课程大纲) · [本地运行](#本地运行) · [部署](#部署)

</div>

---

## 项目定位

Hi-Agent 不是又一份 "API 调用教程"，也不是简单的 Prompt 集锦。

它的目标是：**帮你建立一套清晰的 Agent 工程认知框架**，让你在面对 OpenClaw、Harness、MCP、Skill、A2UI 等不断涌现的新概念时，能从工程视角看清楚它们各自解决的是哪一层问题，而不是被信息流牵着走。

整门课程围绕一个核心模型展开 —— Agent 系统的七层结构：

```
┌──────────────────────────────────────────────┐
│  M07  Harness          运行时 / 沙箱 / 评测   │
├──────────────────────────────────────────────┤
│  M06  Multi-Agent      编排 / 通信 / 共识     │
├──────────────────────────────────────────────┤
│  M05  Memory           working / episodic     │
├──────────────────────────────────────────────┤
│  M04  Context          压缩 / 路由 / 召回     │
├──────────────────────────────────────────────┤
│  M03  Tool             schema / boundary      │
├──────────────────────────────────────────────┤
│  M02  Agent Loop       observe → think → act  │
├──────────────────────────────────────────────┤
│  M01  Chat             消息 / 流式 / 协议     │
└──────────────────────────────────────────────┘
```

## 课程大纲

| 模块 | 章节 | 主题 |
|---|---|---|
| M01 | [Chat](./app/docs/chat) | 消息结构、流式输出、角色与协议 |
| M02 | [Agent Loop](./app/docs/agent-loop) | Observe → Think → Act 的核心循环 |
| M03 | [Tool](./app/docs/tool) | schema、副作用、错误边界，工具的设计哲学 |
| M04 | [Context Engineering](./app/docs/context-engineering) | 压缩、路由、注入、召回 |
| M05 | [Memory](./app/docs/memory) | working / episodic / semantic 三层模型 |
| M06 | [Multi-Agent](./app/docs/multi-agent) | 编排模式、通信协议、共识与分工 |
| M07 | [Harness](./app/docs/harness) | 运行时、沙箱、评测环、可观测性 |
| Labs | [WebContainers Pilot](./app/docs/labs/01-webcontainers-pilot) | 浏览器内可运行的 Agent 实验 |

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | [Next.js 15](https://nextjs.org/) (App Router, `output: 'export'`) |
| 文档主题 | [Nextra 4](https://nextra.site/) (`nextra-theme-docs`) |
| 内容格式 | MDX |
| 全文搜索 | [Pagefind](https://pagefind.app/)（构建期生成静态索引） |
| 浏览器内运行时 | [WebContainers](https://webcontainers.io/) (`@webcontainer/api`) |
| 编辑器 / 终端 | `@monaco-editor/react` + `@xterm/xterm` |
| 样式 | 原生 CSS（`app/globals.css`） |
| 测试 | Vitest（单元 + 组件） + Playwright（E2E） |
| 部署 | Docker + Caddy（生产） / GitHub Pages（仅静态阅读，无 Playground） |

## 核心特性

### 📚 七层认知框架的系统课程
按 Chat → Agent Loop → Tool → Context → Memory → Multi-Agent → Harness 的顺序展开，每章既独立成体，又共同构成一张完整的 Agent 工程地图。

### 🧪 浏览器内可运行的 Labs
基于 [WebContainers](https://webcontainers.io/) 在读者浏览器里直接拉起 Node.js 运行时，无需任何后端：

- **Playground 抽屉**：每个 Lab 章节带一个右侧抽屉，集成 Monaco 编辑器、文件树和 xterm 终端。
- **构建期 Snapshot**：`scripts/build-webcontainer-snapshots.mjs` 在构建时把 `examples/labs/*/workspace/` 打成 `.bin` 快照，挂载到浏览器后秒级启动。
- **Manifest 驱动**：每个实验目录下的 `manifest.json` 声明可执行的命令、文件 anchor、入口文件等，正文里的"运行 Demo"按钮按 manifest 调用，无法越权执行任意命令。
- **本地缓存**：通过 `idb-keyval` 把工作区状态持久化到 IndexedDB，刷新页面不丢编辑。

> ⚠️ WebContainer 必须运行在 `crossOriginIsolated` 环境下，需要服务端下发 `COOP/COEP` 响应头。这意味着 Labs 功能在 GitHub Pages 上不可用 —— 详见 [部署](#部署) 一节。

### 🔍 静态全文搜索
`npm run build` 期间用 Pagefind 扫描 `out/` 生成 `_pagefind` 索引，搜索完全在前端完成，零后端依赖。

## 仓库结构

```
hi-agent/
├── app/                              # Next.js App Router
│   ├── docs/                         # 七大模块 + Labs 的 MDX 内容
│   │   ├── chat/  agent-loop/  tool/  context-engineering/
│   │   ├── memory/  multi-agent/  harness/
│   │   └── labs/01-webcontainers-pilot/
│   ├── lib/
│   │   ├── playground/               # WebContainer 集成（manager / drawer / 编辑器 / 终端）
│   │   ├── runnable-code-block.tsx   # 可运行代码块组件
│   │   └── ...
│   ├── layout.jsx  page.jsx  globals.css
│   └── theme-switch-relocator.jsx
├── examples/labs/                    # 各 Lab 的工作区源码 + manifest.json
├── public/                           # 静态资源（构建期注入 webcontainer-snapshots/）
├── scripts/
│   └── build-webcontainer-snapshots.mjs
├── tests/
│   ├── unit/                         # Vitest 单测
│   └── components/                   # @testing-library/react 组件测试
├── docs/superpowers/                 # 设计文档与实施计划
├── docker/Caddyfile                  # 生产部署：注入 COOP/COEP 头
├── Dockerfile                        # 多阶段构建
├── next.config.mjs                   # 静态导出 + basePath + 运行时 headers 切换
└── package.json
```

## 本地运行

### 环境要求
- Node.js **20+**（CI 与 Docker 镜像均使用 20）
- npm 10+

### 启动开发服务器

```bash
npm install
npm run dev
```

打开 http://localhost:3000 。开发模式下 Next.js dev server 会自动注入 COOP/COEP 头，Labs 章节的 WebContainer 直接可用。

### 构建静态站点

```bash
npm run build
```

该命令会依次：

1. `build:snapshots` —— 把 `examples/labs/*/workspace/` 打成 WebContainer 快照，输出到 `public/webcontainer-snapshots/`
2. `next build` —— 静态导出到 `out/`
3. `pagefind --site out` —— 在 `out/_pagefind/` 生成搜索索引

构建完成后 `out/` 目录就是可直接托管的静态站点。

### 测试

```bash
npm run test          # Vitest（单测 + 组件）
npm run test:watch    # 监听模式
npm run test:e2e      # Playwright E2E
```

## 部署

> 自 2026-05 起站点统一通过 CNB 流水线（[.cnb.yml](./.cnb.yml)）构建并部署到自托管 Caddy 容器；GitHub Pages 部署已废弃，旧的 `*.github.io/hi-agent` 路径不再维护。

### 推荐：Docker + Caddy（生产，Labs 完整可用）

由于 WebContainer 强制要求 `crossOriginIsolated`（需服务端下发 `COOP/COEP` 头），生产部署使用多阶段镜像 —— Node 20 构建静态产物，Caddy 2 负责托管并注入安全头。

```bash
# 构建镜像
docker build -t hi-agent-docs:latest .

# 本地试跑（容器 80 → 宿主 8080）
docker run --rm -p 8080:80 hi-agent-docs:latest
```

打开 http://localhost:8080 ，在 DevTools 控制台执行 `window.crossOriginIsolated`，应当返回 `true`。

如果想让 Caddy 直接终结 HTTPS，把 `docker/Caddyfile` 里的 `:80` 改成你的域名，并暴露 443 端口即可，证书由 Caddy 自动申请。

相关文件：
- [`Dockerfile`](./Dockerfile)
- [`docker/Caddyfile`](./docker/Caddyfile)（设置 `Cross-Origin-Embedder-Policy: require-corp` / `Cross-Origin-Opener-Policy: same-origin` / `Cross-Origin-Resource-Policy: cross-origin`）

## 设计文档

项目内部的设计与实施记录位于 [`docs/superpowers/`](./docs/superpowers/)，包括：

- [`specs/2026-05-08-interactive-node-webcontainers-design.md`](./docs/superpowers/specs/2026-05-08-interactive-node-webcontainers-design.md) —— WebContainers 集成的整体设计、约束与权衡。
- [`plans/2026-05-08-webcontainers-runnable-docs-v1.md`](./docs/superpowers/plans/2026-05-08-webcontainers-runnable-docs-v1.md) —— 可运行文档 v1 的分步实施计划。

## 贡献

欢迎以 Issue 或 PR 的形式参与：

- **内容修订**：MDX 章节就在 `app/docs/<module>/`，每章按 `01-getting-started`、`02-core-concepts`、`03-practice` 组织。
- **新增 Lab**：在 `examples/labs/` 下新建工作区目录与 `manifest.json`，把 sectionId 加入 `scripts/build-webcontainer-snapshots.mjs` 的 `targets`，再创建对应的 MDX 页面即可。
- **改进 Playground**：相关代码集中在 `app/lib/playground/`，每个模块都有对应的 Vitest 测试，欢迎补充测试用例。

提交前请确保：

```bash
npm run test
npm run build
```

均通过。

## License

暂未声明开源协议，默认保留全部权利。如需引用或二次分发，请先开 Issue 联系作者。

---

<div align="center">

© 2026 Hi-Agent · Built with Next.js + Nextra + WebContainers

</div>
