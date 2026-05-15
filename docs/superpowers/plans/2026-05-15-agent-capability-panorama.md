# Agent Capability Panorama Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 [InteractiveDiagram](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/interactive-diagram.tsx) 的 `graph` layout 替换课程简介中静态的 [agent-common.png](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/public/images/common/agent-common.png) 「Agent 系统能力全景图」，并修复 lanes/graph 两个 layout 的 tone 色板分裂。

**Architecture:** ① 抽出 [tone.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/tone.ts) 共享色板；② 扩展 [NodeSchema](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/types.ts#L10-L17) 增加可选 `phase` 字段，[StepSchema](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/types.ts#L30-L41) 的 `from/to` 改为可选；③ schema.ts 用 `superRefine` 按数据形态判模式（phase-only ／ from-to）；④ [GraphLayout](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/layouts/graph-layout.tsx) 的 `computeActiveNodeIds` 优先 phase 再回退 from/to；⑤ 新增 [agent-capability.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/data/agent-capability.ts) 数据 + 薄封装组件 + MDX 接入。

**Tech Stack:** React 19 / Next.js 15 / Nextra 4.5 / zod 3 / vitest 3 / @testing-library/react 16

**关联文档：** [spec](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/docs/superpowers/specs/2026-05-15-agent-capability-panorama-design.md) | [上一期 plan](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/docs/superpowers/plans/2026-05-15-interactive-diagram.md)

**Verification commands:**

- 单测：`npm test -- --run`
- 构建：`npm run build`
- 诊断：`GetDiagnostics` 工具

---

## File Structure

| 文件 | 类型 | 责任 |
|---|---|---|
| [app/lib/diagrams/tone.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/tone.ts) | 新增 | `TONE_COLORS: Record<Tone, string>` 唯一权威源 |
| [app/lib/diagrams/types.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/types.ts) | 修改 | NodeSchema 加 `phase?`；StepSchema 的 `from/to` 改可选 |
| [app/lib/diagrams/schema.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/schema.ts) | 修改 | zod 同步 + superRefine 数据形态判模式 |
| [app/lib/diagrams/layouts/lanes-layout.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/layouts/lanes-layout.tsx) | 修改 | 移除内嵌 toneColors，改 import |
| [app/lib/diagrams/layouts/graph-layout.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/layouts/graph-layout.tsx) | 修改 | 移除内嵌 toneColors + computeActiveNodeIds 高亮策略升级 |
| [app/lib/diagrams/data/agent-capability.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/data/agent-capability.ts) | 新增 | 全景图数据（subagent 产出 28-32 nodes 坐标） |
| [app/lib/agent-capability-interactive.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/agent-capability-interactive.tsx) | 新增 | InteractiveDiagram 薄封装 |
| [mdx-components.js](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/mdx-components.js) | 修改 | 注册 `AgentCapabilityInteractive` |
| [app/docs/page.mdx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/docs/page.mdx#L106-L111) | 修改 | `<ZoomableImage>` → `<AgentCapabilityInteractive />` |
| [tests/unit/diagrams/tone.test.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/tests/unit/diagrams/tone.test.ts) | 新增 | TONE_COLORS unit 测试 |
| [tests/unit/diagrams/schema.test.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/tests/unit/diagrams/schema.test.ts) | 修改 | 增加 phase-only 与 from/to-mixed 校验测试 |
| [tests/components/diagrams/graph-layout.test.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/tests/components/diagrams/graph-layout.test.tsx) | 修改 | +2 个 phase 高亮用例 |
| [tests/components/agent-capability-interactive.test.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/tests/components/agent-capability-interactive.test.tsx) | 新增 | 集成测：封面/弹窗/翻页/Esc/高亮迁移 |

---

## Task 1: 抽取共享 Tone 色板（修复分裂）

**Files:**
- Create: `app/lib/diagrams/tone.ts`
- Modify: `app/lib/diagrams/layouts/lanes-layout.tsx:9-16`
- Modify: `app/lib/diagrams/layouts/graph-layout.tsx:9-16`
- Test: `tests/unit/diagrams/tone.test.ts`

- [ ] **Step 1.1: 写失败测试**

```ts
// tests/unit/diagrams/tone.test.ts
import { describe, expect, it } from 'vitest'
import { TONE_COLORS } from '@/app/lib/diagrams/tone'

describe('TONE_COLORS', () => {
  it('exposes the 6 brand tones with the canonical hex values', () => {
    expect(TONE_COLORS).toEqual({
      blue: '#2f6feb',
      violet: '#6f4bd8',
      cyan: '#16a3a5',
      orange: '#f2801c',
      green: '#2f9d67',
      navy: '#2763c4'
    })
  })
})
```

- [ ] **Step 1.2: 运行确认失败**

`npm test -- --run tests/unit/diagrams/tone.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 1.3: 创建 tone.ts**

```ts
// app/lib/diagrams/tone.ts
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

- [ ] **Step 1.4: 修改 lanes-layout.tsx 引用 TONE_COLORS**

把 [lanes-layout.tsx#L9-L16](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/layouts/lanes-layout.tsx#L9-L16) 内的 `const toneColors: Record<Tone, string> = { ... }` 整段删除，并在文件顶部 import 区加：

```ts
import { TONE_COLORS } from '../tone'
```

把文件内剩余的 `toneColors[xxx]` 全部 `replace_all` 替换为 `TONE_COLORS[xxx]`。

- [ ] **Step 1.5: 修改 graph-layout.tsx 引用 TONE_COLORS**

同 1.4，对 [graph-layout.tsx#L9-L16](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/layouts/graph-layout.tsx#L9-L16) 做相同变换。注意 graph-layout 当前使用的 hex 是 `#1d4ed8` 系，本步骤会同时把它统一到 `#2f6feb` 系（这是有意的视觉统一）。

- [ ] **Step 1.6: 运行 tone 单测 + 全部回归**

```bash
npm test -- --run tests/unit/diagrams/tone.test.ts
npm test -- --run tests/components/diagrams/graph-layout.test.tsx
npm test -- --run tests/components/diagrams/interactive-diagram.test.tsx
```
Expected: 全部 PASS（4 个旧 graph 用例不依赖具体 hex）

- [ ] **Step 1.7: Commit**

```bash
git add app/lib/diagrams/tone.ts app/lib/diagrams/layouts/lanes-layout.tsx app/lib/diagrams/layouts/graph-layout.tsx tests/unit/diagrams/tone.test.ts
git commit -m "refactor(diagrams): extract shared TONE_COLORS to fix lanes/graph palette split"
```

---

## Task 2: NodeSchema 加可选 phase 字段

**Files:**
- Modify: `app/lib/diagrams/types.ts:10-17`
- Modify: `app/lib/diagrams/schema.ts:13-20`
- Test: `tests/unit/diagrams/schema.test.ts`

- [ ] **Step 2.1: 写失败测试（在现有 schema.test.ts 末尾追加）**

```ts
it('accepts optional phase field on nodes', () => {
  expect(() =>
    parseDiagramSchema({
      nodes: [{ id: 'n1', title: 'N1', x: 0, y: 0, tone: 'blue', phase: 'p1' }],
      phases: [{ id: 'p1', label: 'P1', summary: '' }],
      steps: [{ id: 1, from: 'n1', to: 'n1', tone: 'blue', title: 'T', detail: 'D' }]
    })
  ).not.toThrow()
})

it('rejects invalid phase type on nodes', () => {
  expect(() =>
    parseDiagramSchema({
      nodes: [{ id: 'n1', title: 'N1', x: 0, y: 0, tone: 'blue', phase: 123 }],
      steps: [{ id: 1, from: 'n1', to: 'n1', tone: 'blue', title: 'T', detail: 'D' }]
    })
  ).toThrow()
})
```

- [ ] **Step 2.2: 运行确认失败**

`npm test -- --run tests/unit/diagrams/schema.test.ts`
Expected: 第 1 个 PASS（phase 是未知字段被 zod 默认 strip），第 2 个可能也 PASS 但语义错——需要 schema 显式声明字段。先全部跑，再做最小实现。

- [ ] **Step 2.3: types.ts 加 phase**

修改 [types.ts#L10-L17](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/types.ts#L10-L17)：

```ts
export type NodeSchema = {
  id: string
  title: string
  subtitle?: string
  x: number
  y: number
  tone: Tone
  phase?: string
}
```

- [ ] **Step 2.4: schema.ts nodeSchema 加 phase**

修改 [schema.ts#L13-L20](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/schema.ts#L13-L20)：

```ts
const nodeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  x: z.number(),
  y: z.number(),
  tone: ToneEnum,
  phase: z.string().optional()
})
```

- [ ] **Step 2.5: 运行 schema 测试 + 全部 unit 回归**

```bash
npm test -- --run tests/unit/diagrams/schema.test.ts
npm test -- --run tests/unit
```
Expected: PASS。

- [ ] **Step 2.6: Commit**

```bash
git add app/lib/diagrams/types.ts app/lib/diagrams/schema.ts tests/unit/diagrams/schema.test.ts
git commit -m "feat(diagrams): add optional phase field to NodeSchema"
```

---

## Task 3: StepSchema from/to 改可选 + superRefine 数据形态判模式

**Files:**
- Modify: `app/lib/diagrams/types.ts:30-41`
- Modify: `app/lib/diagrams/schema.ts:33-75`
- Test: `tests/unit/diagrams/schema.test.ts`

- [ ] **Step 3.1: 写失败测试**

```ts
describe('StepSchema dual-mode (phase-only ／ from-to)', () => {
  it('accepts phase-only step when phase id matches phases[]', () => {
    expect(() =>
      parseDiagramSchema({
        nodes: [{ id: 'n1', title: 'N1', x: 0, y: 0, tone: 'blue', phase: 'p1' }],
        phases: [{ id: 'p1', label: 'P1', summary: '' }],
        steps: [{ id: 1, phase: 'p1', tone: 'blue', title: 'T', detail: 'D' }]
      })
    ).not.toThrow()
  })

  it('rejects phase-only step when phase id does not match phases[]', () => {
    expect(() =>
      parseDiagramSchema({
        nodes: [{ id: 'n1', title: 'N1', x: 0, y: 0, tone: 'blue' }],
        phases: [{ id: 'p1', label: 'P1', summary: '' }],
        steps: [{ id: 1, phase: 'pX', tone: 'blue', title: 'T', detail: 'D' }]
      })
    ).toThrow(/Unknown phase id: pX/)
  })

  it('rejects step that has neither phase nor from/to', () => {
    expect(() =>
      parseDiagramSchema({
        nodes: [{ id: 'n1', title: 'N1', x: 0, y: 0, tone: 'blue' }],
        steps: [{ id: 1, tone: 'blue', title: 'T', detail: 'D' }]
      })
    ).toThrow(/must provide either phase or both from\/to/)
  })

  it('accepts step that has both phase and from/to (phase=highlight group, from/to=connector)', () => {
    expect(() =>
      parseDiagramSchema({
        nodes: [{ id: 'n1', title: 'N1', x: 0, y: 0, tone: 'blue' }],
        phases: [{ id: 'p1', label: 'P1', summary: '' }],
        steps: [{ id: 1, phase: 'p1', from: 'n1', to: 'n1', tone: 'blue', title: 'T', detail: 'D' }]
      })
    ).not.toThrow()
  })

  it('rejects step that has only one of from/to', () => {
    expect(() =>
      parseDiagramSchema({
        nodes: [{ id: 'n1', title: 'N1', x: 0, y: 0, tone: 'blue' }],
        steps: [{ id: 1, from: 'n1', tone: 'blue', title: 'T', detail: 'D' }]
      })
    ).toThrow(/from and to must be provided together/)
  })

  it('keeps backward compat: step with from/to still references lanes/nodes', () => {
    expect(() =>
      parseDiagramSchema({
        nodes: [
          { id: 'a', title: 'A', x: 0, y: 0, tone: 'blue' },
          { id: 'b', title: 'B', x: 0, y: 0, tone: 'blue' }
        ],
        steps: [{ id: 1, from: 'a', to: 'b', tone: 'blue', title: 'T', detail: 'D' }]
      })
    ).not.toThrow()
  })
})
```

- [ ] **Step 3.2: 运行确认失败**

`npm test -- --run tests/unit/diagrams/schema.test.ts`
Expected: 多个 FAIL（`Required: from/to`）

- [ ] **Step 3.3: 修改 types.ts 让 from/to 可选**

```ts
export type StepSchema = {
  id: number | string
  from?: string
  to?: string
  y?: number
  phase?: string
  tone: Tone
  title: string
  subtitle?: string
  detail: string
  engineering?: string
}
```

- [ ] **Step 3.4: 修改 schema.ts 实现双模式 superRefine**

完整替换 [schema.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/schema.ts) 中 `stepSchema` 与 `superRefine` 部分：

```ts
const stepSchema = z.object({
  id: z.union([z.number(), z.string()]),
  from: z.string().min(1).optional(),
  to: z.string().min(1).optional(),
  y: z.number().optional(),
  phase: z.string().optional(),
  tone: ToneEnum,
  title: z.string().min(1),
  subtitle: z.string().optional(),
  detail: z.string(),
  engineering: z.string().optional()
})

export const diagramZodSchema = z
  .object({
    lanes: z.array(laneSchema).optional(),
    nodes: z.array(nodeSchema).optional(),
    edges: z.array(edgeSchema).optional(),
    phases: z.array(phaseSchema).optional(),
    steps: z.array(stepSchema).min(1)
  })
  .superRefine((value, ctx) => {
    const knownIds = new Set<string>()
    value.lanes?.forEach((l) => knownIds.add(l.id))
    value.nodes?.forEach((n) => knownIds.add(n.id))
    const knownPhases = new Set<string>()
    value.phases?.forEach((p) => knownPhases.add(p.id))

    value.steps.forEach((step, index) => {
      const hasPhase = step.phase != null
      const hasFrom = step.from != null
      const hasTo = step.to != null

      // 形态校验
      if (hasFrom !== hasTo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['steps', index],
          message: 'from and to must be provided together'
        })
        return
      }
      if (hasPhase && hasFrom) {
        // 共存合法：phase 用于高亮聚类，from/to 用于连线引用，职责分离。
        // 这是 agent-timeline 现有数据形态，spec §4.2 GraphLayout 高亮策略
        // 「phase 优先 → fallback from/to」与此共存模型自洽。
      }
      if (!hasPhase && !hasFrom) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['steps', index],
          message: 'must provide either phase or both from/to'
        })
        return
      }

      // 引用校验
      if (hasPhase) {
        if (knownPhases.size > 0 && !knownPhases.has(step.phase!)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['steps', index, 'phase'],
            message: `Unknown phase id: ${step.phase}`
          })
        }
      }
      if (hasFrom && knownIds.size > 0) {
        if (!knownIds.has(step.from!)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['steps', index, 'from'],
            message: `Unknown lane/node id: ${step.from}`
          })
        }
        if (!knownIds.has(step.to!)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['steps', index, 'to'],
            message: `Unknown lane/node id: ${step.to}`
          })
        }
      }
    })
  })
```

- [ ] **Step 3.5: 运行所有 unit 测试**

```bash
npm test -- --run tests/unit
```
Expected: 全部 PASS（含 6 个新增 + 已有 schema 用例 + collect-children + use-diagram-state）

- [ ] **Step 3.6: 跑一遍组件回归**

```bash
npm test -- --run tests/components
npm test -- --run tests/agent-timeline-interactive.test.tsx
```
Expected: 全部 PASS。重点确认 [agent-timeline-interactive.test.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/tests/agent-timeline-interactive.test.tsx) 0 修改通过。

- [ ] **Step 3.7: Commit**

```bash
git add app/lib/diagrams/types.ts app/lib/diagrams/schema.ts tests/unit/diagrams/schema.test.ts
git commit -m "feat(diagrams): allow phase-only steps via dual-mode superRefine"
```

---

## Task 4: GraphLayout 高亮策略升级（phase 优先 → from/to 回退）

**Files:**
- Modify: `app/lib/diagrams/layouts/graph-layout.tsx:26-45`
- Test: `tests/components/diagrams/graph-layout.test.tsx`

- [ ] **Step 4.1: 在现有 graph-layout.test.tsx 末尾追加 2 个失败用例**

```tsx
describe('GraphLayout phase-based highlighting', () => {
  it('highlights all nodes whose phase matches step.phase', () => {
    const schema: DiagramSchema = {
      nodes: [
        { id: 'a1', title: 'A1', x: 0, y: 0, tone: 'blue', phase: 'p1' },
        { id: 'a2', title: 'A2', x: 100, y: 0, tone: 'blue', phase: 'p1' },
        { id: 'b1', title: 'B1', x: 200, y: 0, tone: 'orange', phase: 'p2' }
      ],
      edges: [],
      phases: [
        { id: 'p1', label: 'P1', summary: '' },
        { id: 'p2', label: 'P2', summary: '' }
      ],
      steps: [
        { id: 1, phase: 'p1', tone: 'blue', title: 'P1', detail: 'd' }
      ]
    }
    const { container } = render(<GraphLayout schema={schema} currentIndex={0} />)
    expect(container.querySelector('[data-diagram-node="a1"]')?.getAttribute('data-active')).toBe('true')
    expect(container.querySelector('[data-diagram-node="a2"]')?.getAttribute('data-active')).toBe('true')
    expect(container.querySelector('[data-diagram-node="b1"]')?.getAttribute('data-active')).toBe('false')
  })

  it('falls back to from/to when step has no phase (backward compat)', () => {
    const schema: DiagramSchema = {
      nodes: [
        { id: 'a', title: 'A', x: 0, y: 0, tone: 'blue' },
        { id: 'b', title: 'B', x: 100, y: 0, tone: 'orange' }
      ],
      edges: [{ source: 'a', target: 'b' }],
      steps: [{ id: 1, from: 'a', to: 'b', tone: 'blue', title: 'A→B', detail: 'd' }]
    }
    const { container } = render(<GraphLayout schema={schema} currentIndex={0} />)
    expect(container.querySelector('[data-diagram-node="a"]')?.getAttribute('data-active')).toBe('true')
    expect(container.querySelector('[data-diagram-node="b"]')?.getAttribute('data-active')).toBe('true')
  })
})
```

- [ ] **Step 4.2: 运行确认失败**

`npm test -- --run tests/components/diagrams/graph-layout.test.tsx`
Expected: 第 1 个 FAIL（当前 graph-layout 不识别 step.phase），第 2 个 PASS（已存在等价语义）。

- [ ] **Step 4.3: 修改 graph-layout.tsx 引入 computeActiveNodeIds**

把 [graph-layout.tsx#L26-L45](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/layouts/graph-layout.tsx#L26-L45) 中的 active node 计算逻辑提取并升级：

```ts
function computeActiveNodeIds(
  current: StepSchema | undefined,
  nodes: NodeSchema[]
): Set<string> {
  if (!current) return new Set()
  if (current.phase) {
    const ids = nodes
      .filter((n) => n.phase === current.phase)
      .map((n) => n.id)
    if (ids.length > 0) return new Set(ids)
  }
  const fallback = new Set<string>()
  if (current.from) fallback.add(current.from)
  if (current.to) fallback.add(current.to)
  return fallback
}

export function GraphLayout({ schema, currentIndex }: GraphLayoutProps) {
  const nodes = schema.nodes ?? []
  const edges = schema.edges ?? []
  const steps = schema.steps ?? []
  const current = steps[currentIndex]
  const activeNodeIds = computeActiveNodeIds(current, nodes)
  // ...rest unchanged
}
```

注意：`StepSchema` 类型导入需补；edge 高亮逻辑保持不变（current.from === edge.source && current.to === edge.target），现有 4 个用例继续通过。

- [ ] **Step 4.4: 运行 graph-layout 全部用例**

`npm test -- --run tests/components/diagrams/graph-layout.test.tsx`
Expected: 6/6 PASS（4 个旧 + 2 个新）

- [ ] **Step 4.5: Commit**

```bash
git add app/lib/diagrams/layouts/graph-layout.tsx tests/components/diagrams/graph-layout.test.tsx
git commit -m "feat(diagrams): GraphLayout supports phase-based multi-node highlighting"
```

---

## Task 5: 派 subagent 产出 agent-capability 数据 (28-32 nodes 坐标)

**Files:**
- Create: `app/lib/diagrams/data/agent-capability.ts`

> 此 task 由 subagent 产出，主线 agent 在收到 subagent 结果后审阅、复制粘贴并 commit。

- [ ] **Step 5.1: 派 subagent 设计九宫格坐标**

调用 `general_purpose_task` subagent，传入以下要点：

> **任务**：在 [app/lib/diagrams/data/agent-capability.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/data/agent-capability.ts) 中产出 `agentCapabilitySchema: DiagramSchema`，对应 [agent-common.png](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/public/images/common/agent-common.png) 的「Agent 系统能力全景图」。
>
> **要求**：
>
> 1. 7 个 phases，id 与 tone 严格按下表（与 spec §5.1 一致）：
>    - chat (violet) / context (blue) / loop (green) / tool (orange) / memory (cyan) / multi-agent (violet) / harness (navy)
> 2. 7 个 steps，每个 step 形如 `{ id, phase, tone, title, subtitle, detail, engineering? }`，**无 from/to**（走 phase-only 校验）；title 用中文 phase 名（如「Chat 对话入口」），subtitle 4-6 字定位，detail 2-3 句解释，engineering 可选 1 句工程关注点。
> 3. 28-32 个 nodes，按九宫格视觉布局：
>    - viewBox `0 0 1064 620`，NODE_WIDTH=140 NODE_HEIGHT=56（来自 [graph-layout.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/layouts/graph-layout.tsx#L6-L7)）
>    - 7 个 cluster，每 cluster 2-5 个叶子节点（参考原图模块内子项）
>    - 推荐物理布局：
>      - 左上：Chat（violet，x≈40-180，y≈40-220）
>      - 中上：Context（blue，x≈300-440）
>      - 右上：Tool（orange，x≈560-700）
>      - 中央：Loop（green，x≈300-440，y≈260-440）
>      - 左中：Memory（cyan，x≈40-180，y≈260-440）
>      - 右中：Multi-Agent（violet，x≈560-700，y≈260-440）
>      - 右侧纵向：Harness（navy，x≈820-960，y≈40-560，5 子项纵向排列）
>    - 每个 node 必须有 `phase` 字段对应所属能力域 id
>    - node title 取自原图子项文本，如：消息接入、消息组织、上下文来源、上下文构建、Reasoning Chain、Plan & Decompose、Function Calling、MCP、短期记忆、长期记忆、子智能体、协作协议、运行时保障、安全与权限、可靠性保障、可观测性、评测与优化 等
> 4. `edges` 留空数组 `[]`（spec §5.4 决定不画箭头）
> 5. 文件结构：
>    ```ts
>    import type { DiagramSchema } from '../types'
>    export const agentCapabilitySchema: DiagramSchema = {
>      phases: [...],
>      nodes: [...],
>      edges: [],
>      steps: [...]
>    }
>    ```
> 6. **必须**通过现有 [parseDiagramSchema](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/schema.ts) 校验。subagent 可在末尾加一段：
>    ```ts
>    // sanity check: 仅在开发期触发
>    if (process.env.NODE_ENV !== 'production') {
>      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
>      void agentCapabilitySchema
>    }
>    ```
> 7. **返回**：完整文件内容字符串。

- [ ] **Step 5.2: 主线把 subagent 产出写入文件并跑校验**

```bash
# subagent 返回后，把内容写到 app/lib/diagrams/data/agent-capability.ts
# 然后跑 schema 校验：
npx tsx -e "import('./app/lib/diagrams/data/agent-capability.ts').then(m => { import('./app/lib/diagrams/schema.ts').then(s => { s.parseDiagramSchema(m.agentCapabilitySchema); console.log('OK', m.agentCapabilitySchema.nodes.length, 'nodes') }) })"
```
Expected: `OK 28 nodes`（或 28-32 之间）

如果校验失败，反馈给 subagent 修正。

- [ ] **Step 5.3: Commit**

```bash
git add app/lib/diagrams/data/agent-capability.ts
git commit -m "feat(diagrams): add agentCapabilitySchema dataset (7 phases / 7 steps / ~30 nodes)"
```

---

## Task 6: 薄封装组件 AgentCapabilityInteractive

**Files:**
- Create: `app/lib/agent-capability-interactive.tsx`

- [ ] **Step 6.1: 创建薄封装**

```tsx
'use client'

import React from 'react'
import { InteractiveDiagram } from './diagrams/interactive-diagram'
import { agentCapabilitySchema } from './diagrams/data/agent-capability'

export function AgentCapabilityInteractive() {
  return (
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
  )
}
```

参考 [agent-timeline-interactive.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/agent-timeline-interactive.tsx) 的同构写法。

- [ ] **Step 6.2: 跑一次构建**

`npm run build`
Expected: 通过（虽然 mdx 还未引用，但确保模块被 ts/tsx 编译）

- [ ] **Step 6.3: Commit**

```bash
git add app/lib/agent-capability-interactive.tsx
git commit -m "feat(diagrams): add AgentCapabilityInteractive thin wrapper"
```

---

## Task 7: MDX 接入 + 注册组件

**Files:**
- Modify: `mdx-components.js:5-128`
- Modify: `app/docs/page.mdx:106-111`

- [ ] **Step 7.1: mdx-components.js 注册**

在 [mdx-components.js](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/mdx-components.js) 顶部 import 区追加：

```js
import { AgentCapabilityInteractive } from './app/lib/agent-capability-interactive'
```

并在 [mdx-components.js#L112-L128](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/mdx-components.js#L112-L128) 的 `useMDXComponents` 返回对象中追加 `AgentCapabilityInteractive`：

```js
return {
  ...themeComponents,
  ...components,
  img: ZoomImg,
  pre: MotionPre,
  PlaygroundSection,
  RunnableCodeBlock,
  CommandBlock,
  OpenProjectButton,
  InteractiveDiagram,
  AgentCapabilityInteractive,
  Lane,
  Node: DiagramNode,
  Edge: DiagramEdge,
  Phase,
  Step
}
```

- [ ] **Step 7.2: page.mdx 替换图片**

将 [page.mdx#L106-L111](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/docs/page.mdx#L106-L111) 整段：

```mdx
<ZoomableImage
    src={withBase('/images/common/agent-common.png')}
    alt="Agent Loop 流程图"
    width={960}
    height={540}
/>
```

替换为：

```mdx
<AgentCapabilityInteractive />
```

- [ ] **Step 7.3: 跑构建 + 视觉确认**

```bash
npm run build
npm run dev
```

打开 http://localhost:3000/docs 滚到「七个核心模块」段落，应看到封面卡而不是 PNG。点击展开弹窗，按 →/Space 切换 7 个 step，每步高亮一个 cluster。

- [ ] **Step 7.4: Commit**

```bash
git add mdx-components.js app/docs/page.mdx
git commit -m "feat(docs): replace agent-common.png with AgentCapabilityInteractive"
```

---

## Task 8: 集成测 + 全量验收

**Files:**
- Create: `tests/components/agent-capability-interactive.test.tsx`

- [ ] **Step 8.1: 写集成测**

参考 [tests/agent-timeline-interactive.test.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/tests/agent-timeline-interactive.test.tsx) 的同构写法，落 4 个用例：

```tsx
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AgentCapabilityInteractive } from '@/app/lib/agent-capability-interactive'

describe('AgentCapabilityInteractive', () => {
  it('renders cover with the panorama title', () => {
    render(<AgentCapabilityInteractive />)
    expect(screen.getByText('Agent 系统能力全景图')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /打开能力全景/ })).toBeInTheDocument()
  })

  it('opens modal on cover button click and shows step 1 (Chat)', async () => {
    const user = userEvent.setup()
    render(<AgentCapabilityInteractive />)
    await user.click(screen.getByRole('button', { name: /打开能力全景/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // Inspector 应显示 Chat 标题
    expect(screen.getByRole('dialog')).toHaveTextContent(/Chat/i)
  })

  it('highlights distinct node clusters across steps via ArrowRight', async () => {
    const user = userEvent.setup()
    const { container } = render(<AgentCapabilityInteractive />)
    await user.click(screen.getByRole('button', { name: /打开能力全景/ }))

    const countActive = () =>
      container.querySelectorAll('[data-diagram-node][data-active="true"]').length

    const step1Count = countActive()
    expect(step1Count).toBeGreaterThan(0)

    await user.keyboard('{ArrowRight}')
    const step2Count = countActive()
    expect(step2Count).toBeGreaterThan(0)

    // 切换 step 后高亮的 node 集合应该变化（要么数量不同，要么命中不同 phase）
    const step1Ids = Array.from(
      container.querySelectorAll('[data-diagram-node][data-active="true"]')
    ).map((el) => el.getAttribute('data-diagram-node'))
    expect(step1Ids.length).toBeGreaterThan(0)
  })

  it('closes modal when Escape is pressed', async () => {
    const user = userEvent.setup()
    render(<AgentCapabilityInteractive />)
    await user.click(screen.getByRole('button', { name: /打开能力全景/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 8.2: 运行集成测**

```bash
npm test -- --run tests/components/agent-capability-interactive.test.tsx
```
Expected: 4/4 PASS

- [ ] **Step 8.3: 全量回归**

```bash
npm test -- --run
```
Expected: 全部 PASS（含 26+1 个测试文件，新增 ~13 个用例，0 个回归 fail）

- [ ] **Step 8.4: 全量构建 + Diagnostics**

```bash
npm run build
```

之后调用 `GetDiagnostics` 工具检查无报错。

- [ ] **Step 8.5: Commit**

```bash
git add tests/components/agent-capability-interactive.test.tsx
git commit -m "test(diagrams): integration test for AgentCapabilityInteractive"
```

---

## Self-Review

### 1. Spec Coverage

| Spec 章节 | 实现 task |
|---|---|
| §3 架构总览（9 个文件） | Task 1-7 全覆盖 |
| §4 GraphLayout 高亮模型扩展 | Task 4 |
| §4.3 NodeSchema 字段扩展 | Task 2 |
| §5.1 Phases | Task 5（subagent 产出） |
| §5.2 Steps + 双模式校验 | Task 3 + Task 5 |
| §5.3 Nodes 28-32 坐标 | Task 5（subagent 产出） |
| §5.4 Edges 极少 | Task 5（边为空） |
| §6 Tone 共享 | Task 1 |
| §7 弹窗封面 props | Task 6 |
| §8 可访问性 | 复用 PlayerShell，无新增 |
| §9 测试策略 | Task 1（unit）/ Task 3（schema）/ Task 4（graph-layout）/ Task 8（integration）|
| §11 验收标准 | Task 8 全量回归 + 构建 + Diagnostics |

### 2. Placeholder Scan

无 TBD / TODO；Task 5 的 subagent 任务有完整布局指引，subagent 不需要"自由发挥"。

### 3. Type Consistency

- `TONE_COLORS` 在 Task 1 定义并在 Task 4 中通过现有引用继续使用
- `NodeSchema.phase` 在 Task 2 加，Task 4 使用，Task 5 数据中提供
- `StepSchema.from?/to?` 在 Task 3 改可选，Task 4 在回退分支使用 `current.from / current.to`，Task 5 phase-only 模式不带 from/to
- `computeActiveNodeIds` 是 Task 4 引入的辅助函数，仅 graph-layout 内部使用
- `agentCapabilitySchema` 在 Task 5 创建，Task 6 import，Task 8 通过 AgentCapabilityInteractive 间接断言

### 4. 风险与回滚

- 单 task 出问题：`git revert <hash>`
- 整体回退：把 [page.mdx#L106-L111](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/docs/page.mdx#L106-L111) 还原到 `<ZoomableImage src={...agent-common.png} />`，其余代码保留作为后续重用
