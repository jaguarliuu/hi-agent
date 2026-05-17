# Comments System 设计（基于 GitHub Discussions / Issues）

- 状态：草案待评审
- 日期：2026-05-17
- 关联现状：[layout.jsx](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/app/layout.jsx)、[mdx-components.js](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/mdx-components.js)、[next.config.mjs](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/next.config.mjs)、[deploy.yml](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/.github/workflows/deploy.yml)

## 1. 背景与目标

Hi-Agent 课程站点是一个基于 Next.js + Nextra 的 **静态导出**（[next.config.mjs#L25](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/next.config.mjs#L25) `output: 'export'`）站点，部署在 GitHub Pages（`https://jaguarliuu.github.io/hi-agent`），仓库 `jaguarliuu/hi-agent` 已经是 public。读者目前只能通过 issue / 微信反馈，缺少课程页面级的轻量讨论入口，导致：

- 学员对某一节内容的疑问无法沉淀到对应页面
- 作者难以收集页面级反馈，迭代时缺少上下文
- 站点没有"社区感"，留不住读者

**目标**：在每篇课程内容（`app/courses/**/page.mdx`）下方添加一块「讨论与评论」区域，让读者用 GitHub 账号即可在该页面下评论，所有评论数据沉淀到本仓库的 GitHub Discussions（或 Issues）中，作者通过 GitHub 原生界面统一管理。

**非目标**：

- 不引入匿名评论 / 邮箱评论（YAGNI；GitHub 账号即门槛即反垃圾）
- 不自建后端服务（Waline、Artalk 等）（违反 [next.config.mjs](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/next.config.mjs) 的纯静态导出约束）
- 不做评论数据的多平台同步（Disqus 桥接等）
- 本期不为 Studio 编辑预览页（[app/studio](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/app/studio)）启用评论

## 2. 选型

### 2.1 候选对比

| 方案 | 数据源 | 维护活跃度 | 嵌套回复 | 反应表情 | React 组件 | 中国大陆访问 | 适配本项目 |
|---|---|---|---|---|---|---|---|
| **Giscus** | GitHub Discussions | 活跃（[giscus/giscus](https://github.com/giscus/giscus)） | ✅ | ✅ | ✅ `@giscus/react` | 受 GitHub 网络影响 | **★ 推荐** |
| Utterances | GitHub Issues | 维护放缓 | ❌（扁平） | ✅ | ⚠️ 需自封装 | 同上 | 备选 |
| Gitalk | GitHub Issues | 不活跃 | ❌ | ❌ | ⚠️ 旧 | 同上 | 不推荐 |
| Disqus | 第三方 | 活跃 | ✅ | ✅ | ✅ | 广告/隐私差，速度慢 | 不符合调性 |
| Waline | 自建 + LeanCloud | 活跃 | ✅ | ✅ | ✅ | 好 | 违反"不自建后端"非目标 |

### 2.2 决策：采用 Giscus（GitHub Discussions）

理由：

1. **数据模型贴合内容站**：Discussions 天然支持嵌套回复、分类、置顶、reaction；Issues 偏 bug tracker，发评论时 issue 列表会被污染。
2. **活跃维护**：[giscus/giscus](https://github.com/giscus/giscus) 持续迭代，提供官方 React 包 `@giscus/react`。
3. **零后端**：Giscus 服务由官方托管（giscus.app），数据写入本仓库的 Discussions，符合 [next.config.mjs#L25](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/next.config.mjs#L25) `output: 'export'` 静态导出约束。
4. **主题/语言可配**：可与 Nextra 的明暗主题联动，UI 文案可设为 `zh-CN`。
5. **可迁移**：未来若改用自建（Waline/Artalk），可通过导出 Discussions 数据迁出，不锁定。

**对中国大陆访问受限** 这一已知风险，本期采用「友好降级」策略（见 §6 风险与降级），不引入代理服务（YAGNI），后续视数据再做方案 1 的 Cloudflare Workers 代理。

## 3. 架构

### 3.1 分层

```
MDX/JSX page（server component）
  └─ <Comments />                ← 客户端薄封装（'use client'）
       │
       ├─ <SkipIfDisabled>       开关：路径不在白名单 / 段数 < 4 / frontmatter `comments:false` 时返回 null（见 §5.3）
       ├─ <ThemeBridge>          监听 next-themes / nextra theme，向 iframe postMessage 同步主题
       └─ <Giscus />             @giscus/react 官方组件（懒加载，next/dynamic + ssr:false）
            └─ iframe → giscus.app → GitHub Discussions API
```

唯一的客户端边界是 [comments.tsx](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/app/lib/comments/comments.tsx)（新增），其它所有 MDX 页面保持 server component，不破坏静态导出。

### 3.2 文件结构（新增）

```
app/lib/comments/
├─ comments.tsx                 顶层 'use client' 组件（薄封装 @giscus/react）
├─ comments-config.ts           Giscus 配置常量（repo、repoId、category、categoryId、mapping）
├─ use-giscus-theme.ts          订阅 nextra-theme-docs 主题色，返回 'light'|'dark'|'preferred_color_scheme'
└─ comments.css                 .ha-comments-* 样式（globals.css @import）
tests/components/
└─ comments.test.tsx            渲染、开关、主题切换、SSR 安全性
```

### 3.3 全局接入策略：Layout 注入 vs MDX 显式声明

**推荐方案 A：在 Layout 末尾自动注入（默认所有课程页都有评论）**

在 [app/layout.jsx#L96](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/app/layout.jsx#L96) `<RouteMotionShell>` 内 `{children}` 之后追加 `<CommentsBoundary />`：

```jsx
// app/layout.jsx 片段
<RouteMotionShell>
  {children}
  <CommentsBoundary />
</RouteMotionShell>
```

`<CommentsBoundary />` 内部读取 `usePathname()` 决定：

- 命中 `/courses/**`、且不在 `/studio/**`、`/api/**` → 渲染 `<Comments />`
- 其他路径（首页、`/studio`、`/labs/01-webcontainers-pilot/` 这种带 `layout.jsx` 的特殊页）→ 不渲染

**备选方案 B：MDX 中显式声明 `<Comments />`**

通过 [mdx-components.js#L113-L130](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/mdx-components.js#L113-L130) 的 `useMDXComponents` 注册 `Comments` 组件，作者按需在每篇 mdx 末尾写 `<Comments />`。

| 维度 | 方案 A（Layout 注入） | 方案 B（MDX 显式） |
|---|---|---|
| 默认行为 | 全部课程页有评论 | 默认无评论，作者按需开启 |
| 学习成本 | 0（作者无感知） | 需培训作者写 `<Comments />` |
| 例外控制 | 通过白/黑名单或 frontmatter `comments: false` | 不写就没有 |
| 实施复杂度 | 中（路径白名单 + frontmatter 透传） | 低 |

**决策：A + frontmatter 关闭逃生口**。在 page mdx 的 export `metadata` 中支持 `comments: false`（默认 true），通过自定义 hook `usePageMetadata()` 或一个全局 `<CommentsBoundary />` 读取 nextra 暴露的 `useConfig()`/`useFSRoute()`，实现"白名单路径 + frontmatter 兜底关闭"。

## 4. 配置与映射

### 4.1 配置常量与 provider 抽象

集中放在 [comments-config.ts](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/app/lib/comments/comments-config.ts)。**对外暴露统一的 `CommentsConfig` 接口，本期只提供 `giscus` 实现，但接口已为 `utterances` 等后备方案预留**：

```ts
// 类型层：provider 可扩展
export type CommentsProvider = 'giscus' | 'utterances';

export interface CommentsConfig {
  provider: CommentsProvider;
  repo: `${string}/${string}`;
  // 仅 giscus 用到的字段
  giscus?: {
    repoId: string;
    category: string;
    categoryId: string;
    mapping: 'specific';            // 强制 specific + 自传 term，见 §4.2
    strict: '0' | '1';
    reactionsEnabled: '0' | '1';
    emitMetadata: '0' | '1';
    inputPosition: 'top' | 'bottom';
    lang: string;
    loading: 'lazy' | 'eager';
  };
  // 仅 utterances 用到的字段（占位，本期不实现）
  utterances?: {
    issueTerm: 'pathname' | 'url' | 'title' | 'og:title';
    label?: string;
  };
}

export const COMMENTS_CONFIG: CommentsConfig = {
  provider: 'giscus',
  repo: 'jaguarliuu/hi-agent',
  giscus: {
    repoId: 'R_kgDOxxxxxx',          // 从 giscus.app 生成后填入
    category: 'Comments',             // Discussions 中新建的分类名，Announcements 类型
    categoryId: 'DIC_kwDOxxxxxx',
    mapping: 'specific',              // 配合 §4.2 的 normalizePathname 自传 term
    strict: '0',
    reactionsEnabled: '1',
    emitMetadata: '0',
    inputPosition: 'bottom',
    lang: 'zh-CN',
    loading: 'lazy'
  }
};
```

**关键决策（已确认）**：

- **`provider: 'giscus'`**：`<Comments />` 内部按 `provider` 分支选择实现，未来如需切 utterances 仅改一行配置 + 加一个 `comments-utterances.tsx`，主调用方零改动。
- **`category` = `General`，类型 = `Open-ended discussion`**：允许任何登录访客通过 giscus bot 在首条评论时自动创建对应 Discussion，避免 `Announcements` 类型仅 maintainer 可发主题导致首次访问报 "giscus.app 拒绝了我们的请求"。详见 §6.5 与 §9 决策记录。
- **`mapping = 'specific'` + 自传 term**：避免 `mapping=pathname` 时把 [next.config.mjs#L7](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/next.config.mjs#L7) `basePath = /hi-agent` 与本地（无 basePath）映射成两份 discussion，详见 §4.2。
- **`emitMetadata = '0'`**：当前不需要把 discussion 元数据 postMessage 回主页面，关闭可减小体积。

### 4.2 路径规范化

为避免 `basePath` 切换、`trailingSlash: true`（[next.config.mjs#L27](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/next.config.mjs#L27)）以及大小写造成的"同一页面映射成多个 discussion"问题，在 `<Comments />` 内部对传入 Giscus 的 `term` 做规范化：

```ts
function normalizePathname(input: string): string {
  let p = input || '/';
  // 去除 basePath（GH Pages 上是 /hi-agent，本地是空字符串）
  const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
  if (base && p.startsWith(base)) p = p.slice(base.length) || '/';
  // 统一去尾斜杠（首页除外）
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  // 小写化
  return p.toLowerCase();
}
```

并在 Giscus 组件上传 `term={normalizedPathname}` 而非依赖 `mapping=pathname` 的默认行为（此时 mapping 改为 `specific` + 显式 term）。这样无论是 dev、prod、未来切自定义域名，都映射到同一个 discussion。

### 4.3 主题联动

[layout.jsx](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/app/layout.jsx) 通过 nextra-theme-docs 提供明暗模式。`<Comments />` 内 [use-giscus-theme.ts](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/app/lib/comments/use-giscus-theme.ts) 订阅 `document.documentElement` 的 `class`/`data-theme`（nextra 用的是 next-themes，会写 `class="dark"`），将 `'light' | 'dark'` 同步给 `@giscus/react` 的 `theme` prop。组件库会自动 postMessage 到 iframe，触发 Giscus 切主题。

### 4.4 性能与可访问性

- **懒加载**：`loading="lazy"` + `next/dynamic(() => import('./comments'), { ssr: false })`，首屏不拉 giscus.app 脚本。
- **滚动到视口才挂载**：用 `IntersectionObserver` 在评论区距离视口 200px 时再 mount，避免长文页一进入就拉外部资源。
- **a11y**：外层 `<section aria-labelledby="ha-comments-title">`，标题 "讨论与评论"，附说明文字告知读者：登录评论将公开发布到 [Discussions](https://github.com/jaguarliuu/hi-agent/discussions)。
- **离线/网络受限提示**：`onError`（监听 `iframe` 的 `error` 或 5s 内未 ready）则显示降级文案 + "前往 GitHub Discussions" 直达链接（见 §6）。

## 5. 集成步骤

### 5.1 仓库准备（一次性）

1. 在仓库 `Settings → General → Features` 勾选 ✅ Discussions
2. 在 Discussions 中新建分类：`Comments`（类型选 `Announcements`）
3. 安装 [giscus GitHub App](https://github.com/apps/giscus) 到本仓库，授权 Discussions 读写
4. 访问 [giscus.app/zh-CN](https://giscus.app/zh-CN) 生成 `repoId` / `categoryId`，填入 [comments-config.ts](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/app/lib/comments/comments-config.ts)

### 5.2 代码改动清单

| 改动 | 文件 | 说明 |
|---|---|---|
| 新增 | [app/lib/comments/comments.tsx](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/app/lib/comments/comments.tsx) | `'use client'` 包装 `@giscus/react` |
| 新增 | [app/lib/comments/comments-config.ts](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/app/lib/comments/comments-config.ts) | 仓库 / 分类 ID 等配置 |
| 新增 | [app/lib/comments/use-giscus-theme.ts](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/app/lib/comments/use-giscus-theme.ts) | 主题订阅 hook |
| 新增 | [app/lib/comments/comments.css](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/app/lib/comments/comments.css) | 容器样式 |
| 新增 | [app/lib/comments/comments-boundary.tsx](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/app/lib/comments/comments-boundary.tsx) | 路径白名单 + frontmatter 关闭判定 |
| 修改 | [app/layout.jsx](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/app/layout.jsx) | 在 `RouteMotionShell` 中追加 `<CommentsBoundary />` |
| 修改 | [app/globals.css](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/app/globals.css) | `@import "./lib/comments/comments.css"` |
| 修改 | [package.json](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/package.json) | 新增依赖 `@giscus/react` |
| 新增测试 | [tests/components/comments.test.tsx](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/tests/components/comments.test.tsx) | 渲染/开关/降级 |
| 新增 frontmatter 字段说明 | [docs/plans/2026-05-12-course-studio-design.md](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/docs/plans/2026-05-12-course-studio-design.md) 后续补充 | `comments?: boolean` |

### 5.3 路径白名单规则

[comments-boundary.tsx](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/app/lib/comments/comments-boundary.tsx) 内部：

```ts
function shouldShowComments(pathname: string): boolean {
  if (!pathname) return false;
  if (pathname.startsWith('/studio')) return false;
  if (pathname.startsWith('/api')) return false;
  // labs 子路由有独立 layout.jsx（沙箱页），评论体验不佳
  if (pathname.startsWith('/courses/hi-agent/labs/')) return false;
  // 仅在课程内容页启用
  return pathname.startsWith('/courses/');
}
```

### 5.4 frontmatter 兜底

作者可在 mdx 中：

```mdx
export const metadata = {
  title: '...',
  comments: false   // 关闭本页评论
}
```

在 [comments-boundary.tsx](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/app/lib/comments/comments-boundary.tsx) 通过 nextra `useConfig()` 读取 `frontMatter.comments`，false 时不渲染。

> **实现偏移说明（2026-05-17 落地）**：在 P1 阶段实现时，[comments-boundary.tsx](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/app/lib/comments/comments-boundary.tsx) 是挂在 [layout.jsx](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/app/layout.jsx) 而非 mdx 内部，无法直接读取页面级 `metadata`（nextra 4 + `output: 'export'` 下页面 metadata 不会跨边界透传到 layout）。本期改为更可靠的等价方案：在 [comments-config.ts](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/app/lib/comments/comments-config.ts) 暴露 `COMMENTS_PATH_BLOCKLIST: Set<string>`，要关闭某页评论只需把规范化后的路径加入该集合，效果与 frontmatter 等价且关闭决策集中可审计。后续若 nextra 提供稳定的页面元数据透传 API，再切回 frontmatter 方案。

## 6. 风险与降级

### 6.1 中国大陆访问 GitHub 网络不稳定

- **现象**：giscus.app + github.com + avatars.githubusercontent.com 加载慢或失败
- **本期策略**：评论区上方放一行温和提示（仅当 5s 内 iframe 未就绪时才显示）：「评论由 GitHub Discussions 提供，若加载失败可直接前往 [本仓库 Discussions](https://github.com/jaguarliuu/hi-agent/discussions) 留言。」
- **后续可选**：Cloudflare Workers 反代 giscus.app（参考社区方案），不在本期实施

### 6.2 静态导出 + GH Pages 兼容

- 已通过 `next/dynamic({ ssr: false })` + `'use client'` 双保险，确保 `next build && next export` 阶段不会真正调用 `window`
- 所有 Giscus 资源通过 `<script src="https://giscus.app/client.js">` 远程加载，与 [next.config.mjs#L29](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/next.config.mjs#L29) `assetPrefix` 无关

### 6.3 Studio 模式不启用

[app/studio](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/app/studio) 是本地写作 / 预览工作台（[scripts/run-studio.mjs](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/scripts/run-studio.mjs)），通过路径白名单显式排除，避免编辑预览拉外网。

### 6.4 评论 spam / 滥用

- GitHub 账号 + giscus app OAuth 已是天然门槛
- 维护者可在 Discussions 删除 / 锁主题
- 必要时可启用 GitHub Discussions 的 `Limit interactions`（仅协作者评论），实现"应急静默"

### 6.5 Discussions 分类类型限制（2026-05-17 落地修订）

- **现象**：分类若使用 `Announcements` 类型，仅 maintainer 可创建新 Discussion；访客首次访问页面时 giscus 自动建 Discussion 会被 GitHub 的反滥用层拦下，iframe 内显示「giscus.app 拒绝了我们的请求」
- **触发条件**：`category` 类型 = `Announcements`、且页面尚未对应 Discussion、且访客非 maintainer
- **本期决策**：改用 `General`（`Open-ended discussion` 类型），任何登录访客即可由 giscus bot 代为创建
- **变更步骤**（已在 §9 决策记录）：
  1. 仓库 Discussions 分类页确认 / 新建 `General` 分类
  2. 在 [giscus.app/zh-CN](https://giscus.app/zh-CN) 重新选择仓库 + `General` 分类，复制脚本里的 `data-category-id`
  3. 回填 [comments-config.ts](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/app/lib/comments/comments-config.ts) 的 `category` + `categoryId`
  4. 已存在的 `Announcements` 分类可保留也可归档，互不影响
- **回滚策略**：若未来发生 `General` 被滥用，可临时切回 `Announcements`，并配合"维护者预先建好讨论主题"的运营策略

### 6.6 数据可迁移性

- 所有评论以 Discussion thread 形式存在仓库内
- 未来若改用 Waline / 自建：
  1. 通过 GitHub GraphQL API 导出 Discussions
  2. 转换成目标系统格式
  3. 切换 `<Comments />` 实现，path 映射保持 `pathname` 即可复用

## 7. 测试策略

### 7.1 单元测试（[tests/components/comments.test.tsx](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/tests/components/comments.test.tsx)）

参考 [studio-scaffold-dialog.test.tsx](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/tests/components/studio-scaffold-dialog.test.tsx) 的 vitest + @testing-library/react 模式，覆盖：

1. **路径白名单**：`/courses/hi-agent/chat/` 渲染 `<Giscus />`；`/studio/edit/` 不渲染
2. **frontmatter 关闭**：mock `useConfig()` 返回 `frontMatter.comments=false`，断言不渲染
3. **路径规范化**：传入 `/hi-agent/Courses/Hi-Agent/Chat/` 应得到 `/courses/hi-agent/chat`
4. **主题切换**：模拟 `document.documentElement.classList` 增删 `dark`，断言 `theme` prop 正确
5. **SSR 安全**：在 jsdom 关闭模式下 import 模块，确认无 `window is not defined`
6. **降级提示**：未在 5s 内收到 `giscus:ready` postMessage 时显示降级文案

### 7.2 端到端（[playwright.config.ts](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/playwright.config.ts)）

为避免外网依赖污染 CI，**默认不在 e2e 中真实加载 giscus.app**：用 `page.route('**/giscus.app/**', route => route.abort())` 拦截，断言降级提示出现。可选添加一条 `@network` 标签的真实联通用例，仅在本地手动跑。

### 7.3 验证命令

```bash
npm run test                    # vitest，覆盖单元测试
npm run test:e2e                # playwright，验证降级
npm run build                   # 验证 next export 不报错（output: 'export' 兼容）
```

## 8. 推进计划

| 阶段 | 内容 | 产出 | 估时 |
|---|---|---|---|
| P0 | 仓库 Discussions 启用 + giscus app 安装 + 生成 ID | [comments-config.ts](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/app/lib/comments/comments-config.ts) | 0.5h |
| P1 | 实现 `<Comments />` + `useGiscusTheme` + 路径规范化 | 4 个新文件 + 1 个依赖 | 2h |
| P2 | `<CommentsBoundary />` 白名单 + frontmatter 透传 | 在 [layout.jsx](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/app/layout.jsx) 接入 | 1h |
| P3 | 单元测试 + e2e 降级用例 | 2 个测试文件 | 1.5h |
| P4 | 在 1~2 篇代表性课程页（如 [chat/01-getting-started](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/app/courses/hi-agent/chat/01-getting-started/page.mdx)）灰度验证主题 / 嵌套回复 / 移动端 | 截图 + 反馈记录 | 0.5h |
| P5 | 全量放开（合并到 main，触发 [deploy.yml](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/.github/workflows/deploy.yml)） | 上线 | 0.5h |

总计 ~6h，单 PR 即可。

## 9. 开放问题（待评审）

1. **分类用 `Announcements` 还是 `General`？** 前者只有维护者可发新主题（giscus 仍能代为创建），更可控；后者读者可在 Discussions 直接发主题，社区感更强。**当前倾向 Announcements**。
2. **是否在评论区上方加显式的 GitHub OAuth 隐私提示？** 国内合规审慎起见，**倾向加**：一行小字 + 链到 GitHub 隐私政策。
3. **是否对 `/courses/hi-agent/page.mdx`（课程总览页）启用评论？** 总览页评论价值低、容易跑题。**倾向不启用**，仅启用三级及以下页面（路径段数 ≥ 4）。
4. **未来是否考虑 Issues 而非 Discussions 作为 fallback？** 如果 Discussions 在 GitHub 侧 API 出现重大变更（README 提示 giscus "可能随 Discussions API 变化而损坏"），可临时切回 utterances。建议 [comments-config.ts](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/app/lib/comments/comments-config.ts) 设计成 `provider: 'giscus' | 'utterances'` 的可切换形式（接口预留，本期只实现 giscus）。

## 10. 参考

- [giscus/giscus](https://github.com/giscus/giscus) · 官方仓库
- [@giscus/react](https://github.com/giscus/giscus-component) · 官方组件库
- [giscus advanced usage](https://github.com/giscus/giscus/blob/main/ADVANCED-USAGE.md) · 配置项详情
- 现状参考：[layout.jsx](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/app/layout.jsx)、[mdx-components.js](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/mdx-components.js)、[next.config.mjs](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/next.config.mjs)
