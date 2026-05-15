# Interactive Diagram 通用框架设计

- 状态：草案待评审
- 日期：2026-05-15
- 关联现状：[agent-timeline-interactive.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/agent-timeline-interactive.tsx)、[agent-timeline-interactive.test.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/tests/agent-timeline-interactive.test.tsx)

## 1. 背景与目标

「课程简介」已经把 [agent-timeline.png](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/public/images/common/agent-timeline.png) 静态图替换成可交互时序图（[agent-timeline-interactive.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/agent-timeline-interactive.tsx)）。后续课程里还有 11+ 张时序图与架构图（见 [public/images/common](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/public/images/common)），希望都享受同一套「封面卡 + 弹窗播放器 + 阶段跳转」的叙事体验，而不是每张图重写一遍 React 代码。

目标：**提供一个统一的 InteractiveDiagram 框架**，让内容作者在 MDX 中用声明式 JSX（或纯数据）描述图，框架负责：封面卡、模态弹窗、播放控制、阶段导航、键盘快捷键、Inspector 面板、可访问性。具体「画什么」由可插拔的 Layout 决定。

非目标：

- 不引入图编辑器 / 拖拽 UI（YAGNI）
- 不引入 mermaid / d2 等外部 DSL（视觉一致性优先）
- 不做自动布局（节点坐标由作者手工指定）
- 不在本期一次性迁移所有 11 张图（仅迁移现有 timeline + 一张架构图样板）

## 2. 架构

### 2.1 分层

```
MDX (server component)
  └─ <InteractiveDiagram layout="lanes" data={...} /> 或 children 形式
       │ 'use client' 边界
       ├─ <CoverCard>           固定渲染（首屏可见）
       └─ <ModalPlayer>         懒加载（next/dynamic），打开弹窗时拉取 chunk
            ├─ <PlayerControls> 上一步 / 播放 / 下一步
            ├─ <PhaseNav>       阶段跳转
            ├─ <Inspector>      右侧详情卡
            └─ <DiagramCanvas layout=...>
                 ├─ LanesLayout
                 ├─ GraphLayout
                 └─ FlowLayout
```

唯一的 `'use client'` 边界是 [interactive-diagram.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/interactive-diagram.tsx)。MDX 编译产物保持 server component，符合 [next.config.mjs](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/next.config.mjs) `output: 'export'` 静态导出约束。

### 2.2 文件结构

```
app/lib/diagrams/
├─ interactive-diagram.tsx        顶层容器（'use client'）
├─ player-shell.tsx               PlayerControls + Inspector + PhaseNav + Modal
├─ cover-card.tsx                 封面卡入口
├─ schema.ts                      zod schema + parseDiagramSchema()
├─ types.ts                       TS 类型导出
├─ use-diagram-state.ts           useReducer 状态机
├─ children/
│   ├─ lane.tsx                   compound child：仅采集 props
│   ├─ phase.tsx
│   └─ step.tsx
├─ layouts/
│   ├─ lanes-layout.tsx           泳道时序图（覆盖现有 agent-timeline）
│   ├─ graph-layout.tsx           节点-连线架构图
│   └─ flow-layout.tsx            线性流程图
├─ data/
│   └─ agent-timeline.ts          现有时序图迁移后的 schema 数据
└─ diagram.css                    所有 .ha-diagram-* 样式（由 globals.css @import）
```

[agent-timeline-interactive.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/agent-timeline-interactive.tsx) 改写成「调用 `<InteractiveDiagram data={agentTimelineSchema} />` 的薄封装」，对外的 `AgentTimelineInteractive` 命名导出保留，**[page.mdx#L62](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/docs/page.mdx#L62) 不需要任何改动**。

### 2.3 MDX 全局注册

在 [mdx-components.js#L106-L116](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/mdx-components.js#L106-L116) 的 `useMDXComponents` 中注册 `InteractiveDiagram`、`Lane`、`Phase`、`Step` 四个组件，让所有 MDX 页面无需 import 即可使用。

## 3. API

### 3.1 双形态：data 优先，children 兜底

为现有 15 步 timeline 写 15 个 `<Step />` JSX 行数会膨胀 3-5 倍且不利 diff。`<InteractiveDiagram>` 同时接受：

```tsx
// 形态 A：数据驱动（推荐用于步骤数 > 5 的复杂图）
<InteractiveDiagram layout="lanes" data={agentTimelineSchema} />

// 形态 B：声明式 children（推荐用于步骤数 ≤ 5 的小图）
<InteractiveDiagram layout="graph" id="agent-modules" coverEyebrow="Architecture">
  <Lane id="chat" title="Chat 层" tone="violet" />
  <Phase id="context" label="上下文准备">
    <Step from="chat" to="context" tone="blue" title="..." subtitle="..." detail="..." />
  </Phase>
</InteractiveDiagram>
```

两种形态在内部都被解析为同一份 `DiagramSchema`，再交给 layout 渲染。data 与 children 同时传入时以 data 为准，children 仅作为 fallback。

### 3.2 通用 props（所有 layout 共用）

```ts
interface InteractiveDiagramProps {
  /** 唯一 id，作为 modal aria-labelledby、CSS scope 标识 */
  id: string
  layout: 'lanes' | 'graph' | 'flow'
  /** 封面卡顶部小字 */
  coverEyebrow?: string
  /** 封面卡主标题 */
  coverTitle: string
  /** 封面卡描述 */
  coverDescription?: string
  /** 弹窗主标题（默认沿用 coverTitle） */
  modalTitle?: string
  /** 自动播放间隔（ms），默认 1400 */
  autoPlayInterval?: number
  /** 数据形态 */
  data?: DiagramSchema
  /** 声明式形态 */
  children?: React.ReactNode
}
```

### 3.3 DiagramSchema（zod 校验）

```ts
const ToneEnum = z.enum(['blue', 'violet', 'cyan', 'orange', 'green', 'navy'])

const DiagramSchema = z.object({
  lanes: z.array(z.object({
    id: z.string(),
    title: z.string(),
    subtitle: z.string().optional(),
    tone: ToneEnum
  })).optional(),                // graph layout 不需要 lanes
  nodes: z.array(z.object({
    id: z.string(),
    title: z.string(),
    subtitle: z.string().optional(),
    x: z.number(),
    y: z.number(),
    tone: ToneEnum
  })).optional(),                // lanes layout 不需要 nodes
  edges: z.array(z.object({
    source: z.string(),
    target: z.string()
  })).optional(),
  phases: z.array(z.object({
    id: z.string(),
    label: z.string(),
    summary: z.string()
  })).optional(),
  steps: z.array(z.object({
    id: z.union([z.number(), z.string()]),
    from: z.string(),            // lane id 或 node id
    to: z.string(),
    y: z.number().optional(),    // lanes layout 用
    phase: z.string().optional(),
    tone: ToneEnum,
    title: z.string(),
    subtitle: z.string().optional(),
    detail: z.string(),
    engineering: z.string().optional()
  }))
})
```

`parseDiagramSchema(input)` 在 dev 模式下抛错（贴近 [manifest-schema.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/playground/manifest-schema.ts) 的写法），prod 模式 `console.warn` 后退回原数据。

### 3.4 compound 子组件识别

为绕过 React 19 + MDX 编译可能改 `child.type` 的风险，每个幽灵子组件挂静态字段：

```ts
function Lane(_props: LaneProps): null { return null }
Lane.__diagramKind = 'lane' as const
```

`interactive-diagram.tsx` 用 `React.Children.toArray(children)` 遍历，依靠 `child.type.__diagramKind` 判别，而非 `child.type === Lane`。

## 4. 状态机（useReducer）

```ts
type DiagramState = {
  isOpen: boolean
  currentIndex: number
  isPlaying: boolean
}

type DiagramAction =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'NEXT' }
  | { type: 'PREV' }
  | { type: 'GOTO'; index: number }
  | { type: 'TOGGLE_PLAY' }
  | { type: 'PAUSE' }
```

reducer 把现状的 5 处 setState 调用合并到一处，保证 phase 跳转 / 播放 / 步进的边界条件不会出现 `currentIndex` 越界。

## 5. 多实例并存

### 5.1 body overflow 引用计数

弹窗打开时锁滚动，关闭时还原。多个 diagram 同时打开（极少发生但要兜底）需要避免「先关的把 overflow 还原坏了」：

```ts
// player-shell.tsx 内部模块级 Set
const openDiagrams = new Set<string>()
let originalOverflow: string | null = null

function lock(id: string) {
  if (openDiagrams.size === 0) {
    originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  openDiagrams.add(id)
}

function unlock(id: string) {
  openDiagrams.delete(id)
  if (openDiagrams.size === 0 && originalOverflow !== null) {
    document.body.style.overflow = originalOverflow
    originalOverflow = null
  }
}
```

### 5.2 键盘事件 scope 与单例约束

ESC、← / → / Space 仅在 `isOpen === true` 的实例上注册监听，关闭即解绑。

**单例约束**：UI 上不存在同时打开两个弹窗的合法路径——封面卡按钮被任意打开的 modal 蒙层完全遮挡，无法点击。`openDiagrams` 引用计数仅作为防御性编程，处理理论可能但实际几乎不发生的多实例情况。本期不为多实例并存做更复杂的焦点协调。

## 6. 可访问性

- 弹窗 `role="dialog"` `aria-modal` `aria-labelledby`：沿用现有
- **新增 focus trap**：弹窗打开后焦点落入 modal 内部第一个可聚焦元素（关闭按钮），Tab/Shift+Tab 在 modal 内循环
- **新增焦点归还**：弹窗关闭后将焦点还给触发它的封面卡按钮（`triggerRef.current?.focus()`）
- **新增键盘快捷键**：`←` 上一步、`→` 下一步、`Space` 播放/暂停、`Esc` 关闭
- 步骤内容区使用 `aria-live="polite"`，让屏幕阅读器朗读最新步骤标题

## 7. SSR / 静态导出

- [next.config.mjs](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/next.config.mjs) 是 `output: 'export'`，组件运行在客户端 hydration 后
- `createPortal(document.body)` 仅在 `useEffect` mount 后调用（`mounted` 标志位 + 早期 return null）
- SSR 阶段只渲染 `<CoverCard>`，modal 由客户端首次 render 时按需挂载
- ModalPlayer 用 `next/dynamic(() => import('./player-shell'), { ssr: false })` 切分 chunk，封面卡同步加载、弹窗内容懒加载

## 8. 样式归属

- 新建 [diagram.css](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/diagram.css) 独立文件，所有类名前缀 `.ha-diagram-*`
- 由 [globals.css](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/globals.css) 顶部 `@import` 引入
- 现有 `.ha-agent-timeline-*` 类名（[globals.css#L2738+](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/globals.css)）**不动**：迁移期沿用旧类，本期不重命名以降低视觉回归风险（独立 task：在框架稳定后做样式归一化）

## 9. Layout 能力边界

| Layout | 适用图样例 | 数据形态 | 高亮策略 |
|---|---|---|---|
| `lanes` | [agent-timeline.png](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/public/images/common/agent-timeline.png)、[ws-sse.png](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/public/images/common/ws-sse.png)、[sse-detail.png](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/public/images/common/sse-detail.png)、[sse-tool.png](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/public/images/common/sse-tool.png) | lanes + steps（含 from/to/y） + phases | 当前 step 的两个泳道高亮、连线高亮 |
| `graph` | [agent-common.png](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/public/images/common/agent-common.png)、[agent-loop.png](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/public/images/common/agent-loop.png)、[cc-claw.png](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/public/images/common/cc-claw.png) | nodes（含 x,y） + edges + steps（每个 step 高亮哪个 node 或 edge） | 当前 step 高亮 1 个 node + 0..n 条 edge |
| `flow` | [error-line.png](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/public/images/common/error-line.png)、[jitter.png](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/public/images/common/jitter.png) | nodes（自动竖向布局） + steps | 当前 step 高亮 1 个节点 |

`flow` 在本期**仅预留接口**，不实现，留给后续迭代（YAGNI）。

## 10. 渐进迁移范围

### 10.1 本期范围（必做）

1. 建立框架代码：[app/lib/diagrams/](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams) 全部新文件
2. **lanes layout** 完整实现，与现有 [agent-timeline-interactive.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/agent-timeline-interactive.tsx) 视觉与行为完全等价
3. 把现有时序图数据迁出到 [data/agent-timeline.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/data/agent-timeline.ts)
4. 把 [agent-timeline-interactive.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/agent-timeline-interactive.tsx) 改成 `<InteractiveDiagram data={agentTimelineSchema} />` 的薄封装
5. **graph layout** 最小可用实现 + 一张架构图样板（不接入 MDX，仅在单测中验证可扩展性）
6. MDX 全局注册（在 [mdx-components.js](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/mdx-components.js)）
7. zod schema + `parseDiagramSchema`
8. 弹窗多实例 / focus trap / 键盘快捷键
9. [agent-timeline-interactive.test.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/tests/agent-timeline-interactive.test.tsx) 继续 100% 通过（不修改测试，验证「行为完全等价」）
10. 新增 vitest 单测覆盖：schema 校验、reducer、focus trap、graph layout 渲染

### 10.2 显式不做（推迟）

- `flow` layout 实现
- 9 张其他图的内容数据填写（属于内容工作，非工程工作）
- 旧 `.ha-agent-timeline-*` 类名重命名为 `.ha-diagram-*`
- 拖拽编辑器 / 可视化 schema 工具
- 自动布局（force-directed）

## 11. 验收标准

1. `npm test`（vitest）全部通过，且现有 [agent-timeline-interactive.test.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/tests/agent-timeline-interactive.test.tsx) **零修改**继续通过
2. `npm run build`（包含 `build:snapshots` + `next build` + pagefind）成功
3. `GetDiagnostics` 0 error 0 warning
4. 浏览器手动检验：[课程简介](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/docs/page.mdx) 页面交互时序图视觉与行为与改造前肉眼无差
5. 新增样板架构图在单测中可正确渲染节点 + 高亮指定 step

## 12. 风险与对策

| 风险 | 对策 |
|---|---|
| children 形态在 React 19 + MDX 下 type 比对失效 | 使用 `__diagramKind` 静态标识，不依赖 `child.type === Lane` |
| modal 多实例 body overflow 串台 | 引用计数（§5.1） |
| 弹窗懒加载首次打开闪屏 | `next/dynamic` `loading` fallback 用骨架屏；预加载在封面卡 hover 时触发 |
| 现有测试因实现细节变化而失败 | 测试只断言用户可见行为（heading、role、文本），实现层重构不影响断言 |
| zod 体积影响首屏 | zod 已是 [manifest-schema.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/playground/manifest-schema.ts) 现有依赖，复用即可，不增加体积 |

## 13. 自检清单

- [x] 占位符扫描：无 TBD / TODO
- [x] 内部一致性：layout 与 schema 字段在 §3、§9 对齐
- [x] 范围聚焦：明确「本期不做」清单（§10.2）
- [x] 歧义检查：data vs children 优先级（§3.1）、多实例 overflow 还原（§5.1）、SSR 边界（§7）均已显式声明
