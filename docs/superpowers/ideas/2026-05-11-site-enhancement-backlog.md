# Hi-Agent 站点增强功能候选清单

> **Status:** Backlog · Ideas Pool
> **Last updated:** 2026-05-11
> **Purpose:** 集中记录"Nextra 文档站 + Agent 工程课程"可以考虑接入的增强功能。用作功能选型的参考，不代表承诺要做。
>
> **使用方式：** 后续决定做某一项时，把对应条目从这里"晋升"到 `docs/superpowers/specs/` 写正式设计，再到 `docs/superpowers/plans/` 写实施计划。

---

## 约束与前提

在挑选任何功能之前，先记住当前技术栈给出的边界：

| 维度 | 现状 | 影响 |
|---|---|---|
| 构建模式 | `output: 'export'`（Next.js 静态导出） | 任何方案要么走纯前端 / 第三方 SaaS，要么要新增独立后端 |
| 部署 | Docker + Caddy（生产）· GitHub Pages（备选，无 Labs） | 已具备自定义响应头能力，可承载 COOP/COEP、长连接等 |
| Cross-Origin Isolation | 已开启 | 除 WebContainers 外，SQLite-WASM、Pyodide 等重型 WASM 都能跑 |
| 全文搜索 | Pagefind，构建期生成 `out/_pagefind/` | 可以直接复用为 RAG 的候选池，无需再维护向量库 |
| 内容 | 中文为主，MDX | i18n / TTS / 分享卡片都要考虑中文排版 |
| 主题 | AI Agent 工程课程 | 最强的功能 = 站点本身成为"它教的东西的活样本" |

---

## 🟢 第一梯队：与课程主题强相关

### T1-01 · AI 问答助手（"Hi-Agent 的 Hi-Agent"）

- **形态：** 右下角浮窗，自然语言提问 → 流式回答 + 引用章节链接。
- **RAG 数据源：**
  - 轻量：直接复用 `out/_pagefind/` 的 JSON 索引作为召回池。
  - 重型：构建期把 MDX chunked 后嵌入向量，存 Cloudflare Vectorize / Upstash Vector。
- **后端：** Cloudflare Workers / Vercel Edge Function + OpenAI / DeepSeek API。
- **课程加分：** M01 Chat / M03 Tool（搜索即 tool）/ M04 Context / M05 Memory（保留会话）全部命中。
- **预估成本：** 1-2 天 MVP，主要在 API key、限流、prompt 调教。
- **风险：** API 成本。需要做 rate limit + 匿名 session quota。

### T1-02 · BYOK（Bring Your Own Key）Lab

- **形态：** 在 Playground 抽屉加"密钥设置"，让读者填自己的 OpenAI / Anthropic / DeepSeek key，**只存 IndexedDB，不上传服务器**。
- **现状：** `examples/labs/01-webcontainers-pilot/manifest.json` 已经声明 `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` 三个 env，基础已经搭好。
- **扩展：**
  - 预算守门：单会话最多 N 轮、最多 X tokens，超了降级到 mock。
  - 可观测性：把每次 tool call / model response 打印到 xterm，对应 M07 Harness "可观测性"。
- **预估成本：** 半天（读 env 入口、加一个 modal、写存储封装）。

### T1-03 · Agent Loop 可视化器

- **形态：** 嵌在 M02 Agent Loop 章节里的交互式时序图。点 "下一步"，看 Observe → Think → Act 一帧一帧推进，显示模型输出、tool call、tool result、context diff。
- **数据源：**
  - v1：预录 trace（JSON 固定剧本）。
  - v2：接入 T1-02 的 Lab 实时会话。
- **技术：** 纯 React + SVG/CSS 动画。
- **价值：** 其他 Agent 教程做不到，是**护城河级**功能；同时本身就是 M07 "可观测性"的标杆样例。

### T1-04 · MCP 协议交互 Demo

- **形态：** 用 WebContainer 跑一个迷你 MCP server + 一个 MCP client，读者亲手观察 `tools/list`、`tools/call` 的 JSON-RPC 报文。
- **放置位置：** M03 Tool 章节。
- **优势：** MCP 在 2026 年是必学内容，而"在浏览器里实时观察协议"的体验**只有你能做**（靠 WebContainer）。
- **预估成本：** 2-3 天（MCP server 最小实现 + 报文抓取 UI）。

---

## 🟡 第二梯队：通用但显著提质感

### T2-01 · Mermaid / 时序图 / 状态机
- Nextra 4 默认不带 Mermaid，需要自定义 MDX 组件封装 [`mermaid`](https://mermaid.js.org/)。
- Agent 系统有大量状态机 / 流程图内容（M01 已用 PNG），Mermaid 化后支持暗色适配、可复制、版本控制。
- **成本：** 半天集成 + 逐步替换存量图片。

### T2-02 · Giscus 评论系统
- 一行 `<Giscus />` 组件，基于 GitHub Discussions，免费 + GitHub OAuth 登录。
- 对"持续更新"的课程，评论是最低成本的反馈渠道。
- **成本：** 1-2 小时。

### T2-03 · 阅读进度 / Lab 通关状态
- LocalStorage 记录"读到第几章"，首页展示进度条。
- 配合 Lab 的 `manifest.json` 执行记录，形成"学习路径打卡"。
- **成本：** 1 天，包括打磨视觉。

### T2-04 · 代码块增强（Diff / 多语言 Tab / 行注释气泡）
- 现有 `runnable-code-block.tsx` 基础上扩展：
  - Diff 语言高亮（M03 Bad vs Good、M04 提示词演进最有用）。
  - 多 Tab（Python / TS / Rust 同一段逻辑）。
  - 行高亮 `{1,3-5}` + marker 气泡做"分镜式"讲解。
- **成本：** 每种特性约半天。

### T2-05 · OpenGraph 分享卡片自动生成
- 构建期用 `@vercel/og` 或 `satori` 给每个 MDX 页面生成 OG 图（模块色 + 标题 + 模块编号）。
- 分享到 Twitter / 微信 / 群里视觉效果提升巨大。
- **成本：** 半天到 1 天，踩过一次坑之后很可复用。

### T2-06 · 搜索升级（AI 摘要）
- 基于 T1-01 的 RAG 端点：
  - 搜索框升级为"问答框"，自然语言查询。
  - Pagefind 关键词结果右侧给 AI 摘要。
- 依赖 T1-01 完成。

### T2-07 · 站点动效体系 · **已晋升**
- **状态：** Promoted → `specs/2026-05-11-site-motion-design.md` · `plans/2026-05-11-site-motion-v1.md`
- **范围：** 主题切换 / 抽屉滑入 / 标签 magic-line / FLIP 飞行 / 阅读进度条等 20+ 动效，按三波交付。
- **核心约束：** 每个动效必须沟通"空间/状态/因果/进度"四者之一；≤ 400ms；尊重 `prefers-reduced-motion`。
- **收益：** 现在深浅切换瞬变、WebContainer 启动无感知进度、Tab 切换硬跳 —— 这些都是当前体感最低的位置。
- **成本：** Wave 1 约 1-2 天、Wave 2 约 2-3 天、Wave 3 约 2 天（可选）。

---

## 🟠 第三梯队：有趣，但要算 ROI

### T3-01 · i18n（中英双语）
- Nextra 4 的 i18n 还在迭代，工作量不小。
- 可分阶段：LLM 批量翻译骨架 → 作者校对核心章节 → SEO 扩展到海外。
- **隐藏收益：** 英文版会显著拓宽受众，是"影响力杠杆"。

### T3-02 · 音频版 / TTS 朗读
- "听课模式"按钮，调 ElevenLabs / OpenAI TTS / 豆包 TTS，音频缓存到对象存储。
- 覆盖通勤、健身、做家务等"不能看屏幕"的场景。
- **成本：** API 费 + 1-2 天集成。

### T3-03 · 章末互动选择题 / 知识检测
- 每章末尾 3 道题，答错给提示。
- 轻量 React 组件 + JSON 题库。
- **加分点：** 和 T2-03 进度系统联动，变成"过关制"。

### T3-04 · Excalidraw / TLDraw 嵌入
- 读者在 Lab 里画自己的 Agent 架构图，IndexedDB 持久化。
- M06 Multi-Agent、M07 Harness 最合适。

### T3-05 · 结课证书 / GitHub 徽章
- 读完七章 + 完成 Lab → 生成 SVG 证书 + GitHub README 徽章代码。
- 社交分享利器。**心理学奖励环节。**

---

## 🔴 第四梯队：酷但与课程关系弱（慎重）

- **3D 落地页（Three.js / Spline）**：维护成本高，分散注意力。
- **博客 / 周报模块**：除非长期坚持写，否则空置观感差。
- **Discord / Slack Bot**：需要长期运营人力。
- **付费墙 / 会员系统**：和"认知框架型"课程调性冲突。

---

## 参考优先级矩阵

| 候选 | 课程贴合度 | 实现成本 | 杠杆率 | 建议 |
|---|---|---|---|---|
| T1-01 AI 问答 | ★★★★★ | ★★☆ | ★★★★★ | **第一批** |
| T1-02 BYOK Lab | ★★★★★ | ★☆☆ | ★★★★ | **第一批** |
| T1-03 Loop 可视化 | ★★★★★ | ★★★ | ★★★★★ | 第二批，护城河 |
| T1-04 MCP Demo | ★★★★★ | ★★★ | ★★★★ | 第二批 |
| T2-02 Giscus | ★★☆ | ☆ | ★★★ | **最快一批，先上** |
| T2-01 Mermaid | ★★★ | ★ | ★★★ | 插空做 |
| T2-05 OG 卡片 | ★★☆ | ★★ | ★★★ | 上线前做 |
| T2-03 进度系统 | ★★★ | ★★ | ★★ | 课程稳定后 |
| T3-01 i18n | ★★★★ | ★★★★ | ★★★★ | 有海外意图时 |
| T3-02 TTS | ★★ | ★★ | ★★★ | 看用户反馈 |

---

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-05-11 | 初稿，收录四档共 20+ 候选功能 |
| 2026-05-11 | 新增 T2-07 动效体系，直接晋升至 specs/plans |
