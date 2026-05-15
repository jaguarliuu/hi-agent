# Agent 系统能力全景图 · 可交互替换设计

> 日期：2026-05-15
> 关联：[2026-05-15-interactive-diagram-design.md](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/docs/superpowers/specs/2026-05-15-interactive-diagram-design.md)

## 1. 背景与目标

「课程简介」中的 [agent-common.png](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/public/images/common/agent-common.png) 是一张「Agent 系统能力全景图」，9 宫格架构图：把 Agent 拆成 7 个核心能力域（Chat / Context Engineering / Agent Loop / Tool / Memory / Multi-Agent / Harness），每个域内罗列若干能力点，再加上下方的「输出与触达」「典型应用场景」两条横向条带。它当前以静态 [PNG](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/public/images/common/agent-common.png) 形式嵌在 [page.mdx#L106-L111](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/docs/page.mdx#L106-L111)。

本期目标：

1. 将这张静态全景图替换为 [InteractiveDiagram](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/interactive-diagram.tsx) 的 `graph` layout 可交互实例，作为继 [agent-timeline-interactive.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/agent-timeline-interactive.tsx) 之后的**第二张实验图**，验证框架在「graph + 多节点高亮」场景下的可行性。
2. 顺手修复上一轮交付遗留的 **tone 色板分裂**：把 [lanes-layout.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/layouts/lanes-layout.tsx#L9-L16) 与 [graph-layout.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/layouts/graph-layout.tsx#L9-L16) 自带的两套不同 hex 抽到共享的 `tone.ts`，graph 改用 lanes 的权威色板（与 [globals.css#L3140-L3145](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/globals.css#L3140-L3145) 保持一致）。

非目标（YAGNI）：

- 不重做配色（保留现有 `#2f6feb / #6f4bd8 / #16a3a5 / #f2801c / #2f9d67 / #2763c4` 6 色）
- 不实现「九宫格容器/分组背景框」这种新 layout（仍用 graph layout，分组用 phase 软关联）
- 不替换其它图（[agent-loop.png](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/public/images/common/agent-loop.png) 等留作后续 PR）

## 2. 用户故事

读者打开课程简介，滚到「七个核心模块」段落，看到一张封面卡：

> 标题：Agent 系统能力全景图  
> 描述：以目标为驱动，围绕对话、上下文、行动、工具、记忆、协作与运行时保障  
> 按钮：打开能力全景

点击进入弹窗后，默认停在 step 1（Chat 域），看到：

- 7 个能力域 + 若干叶子节点全部铺在 SVG 里（结构与原图一致）
- **当前 step 对应的能力域所有节点高亮**（其他节点变淡）
- Inspector 面板显示：当前域名、副标题、3-5 行解释、对应模块跳转链接

按 → 切到 step 2（Context Engineering），高亮迁移；按 Space 自动播放，1.6s/步；按 Esc 关闭。整体节奏与 [agent-timeline-interactive.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/agent-timeline-interactive.tsx) 一致。

## 3. 架构总览

完全复用 [InteractiveDiagram](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/interactive-diagram.tsx) 框架，**不**新增 layout、**不**改 player-shell。落点：

| 文件 | 类型 | 作用 |
|---|---|---|
| [app/lib/diagrams/tone.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/tone.ts) | 新增 | `TONE_COLORS: Record<Tone, string>` 唯一权威源 |
| [app/lib/diagrams/types.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/types.ts) | 修改 | `NodeSchema.phase?: string` 可选字段 |
| [app/lib/diagrams/schema.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/schema.ts) | 修改 | zod 同步增加 `phase` 可选；保留现有 `superRefine` 引用校验 |
| [app/lib/diagrams/layouts/lanes-layout.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/layouts/lanes-layout.tsx) | 修改 | 移除内部 `toneColors`，从 [tone.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/tone.ts) 引用 |
| [app/lib/diagrams/layouts/graph-layout.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/layouts/graph-layout.tsx) | 修改 | 同上 + 高亮改造（见 §4） |
| [app/lib/diagrams/data/agent-capability.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/data/agent-capability.ts) | 新增 | 全景图数据：7 phases + 7 step + ~28 nodes |
| [app/lib/agent-capability-interactive.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/agent-capability-interactive.tsx) | 新增 | InteractiveDiagram 薄封装（约 25 行） |
| [app/docs/page.mdx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/docs/page.mdx) | 修改 | 第 106-111 行 `<ZoomableImage>` → `<AgentCapabilityInteractive />` |
| [mdx-components.js](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/mdx-components.js) | 修改 | 注册 `AgentCapabilityInteractive` |

## 4. GraphLayout 高亮模型扩展（核心变更）

### 4.1 现状

[graph-layout.tsx#L31-L35](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/layouts/graph-layout.tsx#L31-L35)：

```ts
const activeNodeIds = new Set<string>()
if (current) {
  activeNodeIds.add(current.from)
  activeNodeIds.add(current.to)
}
```

只能高亮 2 个节点，且语义是「source → target」。

### 4.2 扩展方案

加一层「优先用 phase 分组高亮，fallback 到 from/to」的策略：

```ts
function computeActiveNodeIds(current, nodes) {
  if (!current) return new Set()
  // 优先：step.phase 命中所有 node.phase === step.phase
  if (current.phase) {
    const ids = nodes.filter(n => n.phase === current.phase).map(n => n.id)
    if (ids.length > 0) return new Set(ids)
  }
  // fallback：仍用 from/to（保持向后兼容）
  return new Set([current.from, current.to])
}
```

向后兼容：

- 没有 `phase` 字段的旧 schema（如 [agent-timeline.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/data/agent-timeline.ts)）行为完全不变（lanes-layout 不受影响）
- 旧的 graph schema 没有给 node 配 `phase`，自动走 fallback，与现有 4 个 graph-layout 测试用例完全一致

### 4.3 NodeSchema 字段扩展

[types.ts#L8-L15](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/types.ts#L8-L15)：

```ts
export type NodeSchema = {
  id: string
  title: string
  subtitle?: string
  x: number
  y: number
  tone: Tone
  phase?: string  // 新增：声明该节点属于哪个能力域，用于 graph 多节点同步高亮
}
```

zod schema 同步：[schema.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/schema.ts) 内 `nodeSchema` 增加 `phase: z.string().optional()`。

### 4.4 superRefine 不需要更新

`step.phase` 引用 `phases[].id`，在 [Task 1 schema.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/schema.ts) 已经存在；node.phase 复用同一规则即可——但 spec 决定 **本期不强制 node.phase 必须命中 phases**：因为画图时可能有不属于任何 phase 的「装饰节点」（如全景图底部的"输出与触达""典型应用场景"），它们不参与高亮。这个开放性减小了未来扩展时的反复改 schema 成本。

## 5. agent-capability 数据模型

### 5.1 Phases（7 个，作为 step + 高亮 group key）

| id | label | summary | tone |
|---|---|---|---|
| `chat` | Chat | 接收和组织消息 | violet |
| `context` | Context Engineering | 准备正确的上下文 | blue |
| `loop` | Agent Loop | 决定下一步行动 | green |
| `tool` | Tool | 获取真实世界的数据 | orange |
| `memory` | Memory | 理解长期偏好 | cyan |
| `multi-agent` | Multi-Agent | 在复杂任务中分工协作 | violet |
| `harness` | Harness | 保证运行时安全、稳定、可控 | navy |

phase id 与现有 [agent-timeline.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/data/agent-timeline.ts) **故意保持一致**，便于未来跨图联动（点 phase 跳转课程章节）。

### 5.2 Steps（7 个，每个 phase 一步）

每个 step：

```ts
{
  id: <1..7>,
  // from/to 在 graph + phase 模式下省略
  phase: '<phase-id>',
  tone: '<同 phase 的 tone>',
  title: '<phase label>',
  subtitle: '<3-6 字定位>',
  detail: '<2-3 句解释这个域负责什么、为什么重要>',
  engineering: '<可选：工程关注点>'
}
```

**Schema 变更（已确认）**：让 [types.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/types.ts#L30-L41) 的 `StepSchema.from / .to` 改为可选，schema.ts 走 `superRefine` 在「数据形态」上做模式判定（注意：`DiagramSchema` 本身不含 layout 字段，layout 是 [InteractiveDiagram](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/interactive-diagram.tsx) 的运行时 prop，不影响 zod 校验）：

对每个 `step`，按下述规则判定模式：

1. **phase-only 模式**（新增）：`step.phase` 已提供且命中 `phases[].id`，并且 `from / to` 都缺省 → 合法（agent-capability 走此路径）
2. **from/to 模式**（保留旧约束）：`step.from` 与 `step.to` 都提供，且都命中 `lanes[].id ∪ nodes[].id` → 合法
3. **共存模式**（兼容现状）：`step.phase` + `step.from` + `step.to` 三者同时提供——phase 用于高亮聚类，from/to 用于连线引用，**职责分离，两路引用都校验**（agent-timeline 走此路径）
4. **错误组合**：`from / to` 单独出现一个 → 报错；既无 phase 又无 from/to → 报错

由 `parseDiagramSchema` 在 `superRefine` 里集中处理。这样 lanes 数据（如 [agent-timeline.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/data/agent-timeline.ts)）行为完全不变；graph 数据获得「phase 分组高亮 ／ from-to 双节点高亮」双形态；GraphLayout 的高亮策略（spec §4.2）「phase 优先 → fallback from/to」与共存模式天然自洽。

> 兼容性：`agent-timeline.ts`（lanes）每个 step 同时带 from/to + phase，走第 3 条共存模式；4 个现有 graph-layout 测试用例只带 from/to，走第 2 条；新的 [agent-capability.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/data/agent-capability.ts) 只带 phase，走第 1 条。

### 5.3 Nodes（约 28 个，按九宫格物理坐标布局）

按原图 9 宫格视觉位置，给每个 node 配 `(x, y)` 绝对坐标。SVG viewBox 沿用 graph-layout 现有 `0 0 1064 620`。一个示例：

```ts
// Chat 域（左上，紫色）
{ id: 'chat-input', title: '消息接入', x: 90, y: 90, tone: 'violet', phase: 'chat' },
{ id: 'chat-org', title: '消息组织', x: 90, y: 150, tone: 'violet', phase: 'chat' },
{ id: 'chat-route', title: '协议与路由', x: 90, y: 210, tone: 'violet', phase: 'chat' },
// Context 域（右上，蓝色）
{ id: 'ctx-source', title: '上下文来源', x: 380, y: 90, tone: 'blue', phase: 'context' },
{ id: 'ctx-process', title: '上下文处理', x: 380, y: 150, tone: 'blue', phase: 'context' },
{ id: 'ctx-construct', title: '上下文构建', x: 380, y: 210, tone: 'blue', phase: 'context' },
// ...
```

具体坐标在 plan 阶段产出，**spec 阶段只承诺**：

- 28-32 个 nodes（密度匹配原图，不做过度压缩）
- node 排布要在视觉上能识别出 7 个 cluster
- 每个 cluster 有 2-5 个 nodes
- 不强求 1:1 还原原图所有像素，**叙事性 > 视觉精确度**

### 5.4 Edges（极少，仅 0-3 条）

原图本身边很少（主要靠空间 cluster 表达分组），全景图保持极简：

- 仅保留有明确流向的「Chat → Context → Loop」「Loop → Tool」「Loop → Memory」3 条主干箭头（可选，初版可为 0 条）
- Step 切换时**不**激活 edges（高亮规则只针对 nodes）

## 6. Tone 色板共享

### 6.1 [app/lib/diagrams/tone.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/tone.ts)（新增）

```ts
import type { Tone } from './types'

export const TONE_COLORS: Record<Tone, string> = {
  blue: '#2f6feb',
  violet: '#6f4bd8',
  cyan: '#16a3a5',
  orange: '#f2801c',
  green: '#2f9d67',
  navy: '#2763c4'
}
```

来源：与 [globals.css#L3140-L3145](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/globals.css#L3140-L3145) 的 `.ha-agent-timeline { --agent-* }` 保持完全一致。

### 6.2 替换点

- [lanes-layout.tsx#L9-L16](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/layouts/lanes-layout.tsx#L9-L16)：删除 `toneColors`，改 `import { TONE_COLORS } from '../tone'`，使用处替换为 `TONE_COLORS[step.tone]`
- [graph-layout.tsx#L9-L16](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/layouts/graph-layout.tsx#L9-L16)：同上

### 6.3 风险

graph-layout 视觉上会从「深沉学院风（#1d4ed8）」变成「品牌活泼蓝（#2f6feb）」，这是有意的统一动作。无现存生产页面使用 graph-layout，故无视觉回归。

## 7. UI / 弹窗细节

封面卡 props：

```tsx
<InteractiveDiagram
  id="agent-capability"
  layout="graph"
  coverEyebrow="Agent System Panorama"
  coverTitle="Agent 系统能力全景图"
  coverDescription="以目标为驱动，围绕对话、上下文、行动、工具、记忆、协作与运行时保障，构建可落地的智能体系统。"
  coverButtonLabel="打开能力全景"
  modalTitle="Agent 能力全景播放器"
  data={agentCapabilitySchema}
  autoPlayInterval={1600}
/>
```

封面预览（[CoverCard](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/cover-card.tsx) 走 `previewNodes` 分支）：会自动从 `nodes` 取前若干显示色块；这刚好契合"7 域多色"的视觉提示，无需特殊定制。

## 8. 可访问性

完全复用 [PlayerShell](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/player-shell.tsx) 的现有能力：focus trap、Esc/←/→/Space 键盘、body overflow 引用计数、aria-modal/aria-labelledby、`aria-live="polite"` Inspector。

graph SVG 当前 `aria-hidden="true"`：保持不变，因为节点信息会以可读文本形式出现在 Inspector 面板中，避免让屏幕阅读器逐个朗读 28 个 SVG `<text>`。这与 lanes-layout 一致。

## 9. 测试策略

| 层 | 文件 | 用例数 | 覆盖点 |
|---|---|---|---|
| unit | [tests/unit/diagrams/tone.test.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/tests/unit/diagrams/tone.test.ts) | 1 | TONE_COLORS 6 个 key + 与 lanes-layout 历史色一致 |
| component | [tests/components/diagrams/graph-layout.test.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/tests/components/diagrams/graph-layout.test.tsx) | 现有 4 + 新增 2 | (新) phase 分组高亮多节点、(新) 同时设置 phase 与 from/to 优先 phase |
| component | [tests/components/diagrams/lanes-layout-tone.test.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/tests/components/diagrams/lanes-layout-tone.test.tsx) | 1 | LanesLayout 渲染 SVG 元素 stroke 命中权威色板 |
| integration | [tests/components/agent-capability-interactive.test.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/tests/components/agent-capability-interactive.test.tsx) | 4 | 封面打开 → step 1/7 → → 切到 step 2 → 高亮节点数变化 → Esc 关闭 |
| regression | 现有 100 个测试 | 0 修改 | 全部通过（含 [agent-timeline-interactive.test.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/tests/agent-timeline-interactive.test.tsx)、4 个旧 graph-layout 用例） |

新增 graph-layout 用例样板：

```tsx
it('phase 分组：step.phase 命中所有 node.phase === step.phase 的节点', () => {
  const schema: DiagramSchema = {
    nodes: [
      { id: 'a1', title: 'A1', x: 0, y: 0, tone: 'blue', phase: 'p1' },
      { id: 'a2', title: 'A2', x: 100, y: 0, tone: 'blue', phase: 'p1' },
      { id: 'b1', title: 'B1', x: 200, y: 0, tone: 'orange', phase: 'p2' },
    ],
    edges: [],
    phases: [
      { id: 'p1', label: 'P1', summary: '' },
      { id: 'p2', label: 'P2', summary: '' },
    ],
    steps: [
      { id: 1, from: 'a1', to: 'a1', phase: 'p1', tone: 'blue', title: 'P1', detail: 'd' },
    ],
  }
  const { container } = render(<GraphLayout schema={schema} currentIndex={0} />)
  expect(container.querySelector('[data-diagram-node="a1"]')?.getAttribute('data-active')).toBe('true')
  expect(container.querySelector('[data-diagram-node="a2"]')?.getAttribute('data-active')).toBe('true')
  expect(container.querySelector('[data-diagram-node="b1"]')?.getAttribute('data-active')).toBe('false')
})

it('回退：step 没有 phase 时仍用 from/to（保持向后兼容）', () => {
  // ...构造无 phase 的 schema，断言只有 from/to 两个节点 active
})
```

## 10. 渐进迁移与回滚

- 每一步都在 InteractiveDiagram 既有契约上展开，无破坏性改动
- 任意一步出问题：`git revert <hash>` 单 task 回滚；最差情况把 [page.mdx#L106-L111](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/docs/page.mdx#L106-L111) 还原到 `<ZoomableImage src={withBase('/images/common/agent-common.png')} ... />` 即可视觉回滚

## 11. 验收标准

- [ ] [page.mdx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/docs/page.mdx) 中原 [agent-common.png](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/public/images/common/agent-common.png) 处变成 `<AgentCapabilityInteractive />`
- [ ] 封面卡视觉与现有 [agent-timeline-interactive.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/agent-timeline-interactive.tsx) 风格一致
- [ ] 弹窗 step 1-7 切换流畅，每个 step 高亮 2-5 个 nodes
- [ ] [lanes-layout.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/layouts/lanes-layout.tsx) 与 [graph-layout.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/layouts/graph-layout.tsx) 不再各自定义 toneColors，全部从 [tone.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/tone.ts) 引用
- [ ] [tests/agent-timeline-interactive.test.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/tests/agent-timeline-interactive.test.tsx) 0 修改通过
- [ ] 4 个现有 graph-layout 用例 0 修改通过
- [ ] 新增 1 + 2 + 1 + 4 = 8 个测试全部通过
- [ ] `npm test` / `npm run build` / GetDiagnostics 均零错误

## 12. 自检（spec 内嵌）

| 检查 | 结论 |
|---|---|
| Placeholder | §5.3 给的 6 个示例 nodes 是说明性，plan 阶段补齐全部 28-32 个；其余无 TBD |
| 内部一致 | NodeSchema phase 扩展 / 高亮策略 / 数据 / 测试 / 验收闭环 |
| 范围 | 仅 1 张图替换 + 1 处色板抽取，单 PR 合理 |
| 歧义 | from/to 在 graph 模式下的语义已在 §5.2 明确「自指、不参与高亮」 |
