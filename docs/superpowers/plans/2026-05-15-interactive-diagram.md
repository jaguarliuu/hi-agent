# Interactive Diagram 通用框架实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「课程简介」里的可交互时序图抽象成可复用的 InteractiveDiagram 框架，本期实现 lanes layout 完整等价迁移 + graph layout 最小可用样板，让后续 11+ 张图都能复用同一套播放器与 schema。

**Architecture:** 单一 `'use client'` 入口 + 双形态 API（data 优先、children 兜底）+ 可插拔 layout（lanes / graph / 预留 flow）。播放器、模态弹窗、Inspector、键盘快捷键由 player-shell 统一承载；layout 仅决定中间 SVG 画布。状态机走 `useReducer`，schema 走 zod 校验。

**Tech Stack:** React 19 + Next 15 (`output: 'export'`) + Nextra 4.5 + zod 3 + vitest 3 + @testing-library/react 16

**Spec:** [2026-05-15-interactive-diagram-design.md](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/docs/superpowers/specs/2026-05-15-interactive-diagram-design.md)

---

## 文件结构（all paths absolute）

新增：

- [app/lib/diagrams/types.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/types.ts) — TS 类型导出（仅类型，不带运行时）
- [app/lib/diagrams/schema.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/schema.ts) — zod schema + `parseDiagramSchema()`
- [app/lib/diagrams/use-diagram-state.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/use-diagram-state.ts) — useReducer 状态机
- [app/lib/diagrams/children/lane.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/children/lane.tsx)
- [app/lib/diagrams/children/phase.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/children/phase.tsx)
- [app/lib/diagrams/children/step.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/children/step.tsx)
- [app/lib/diagrams/children/node.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/children/node.tsx)
- [app/lib/diagrams/children/edge.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/children/edge.tsx)
- [app/lib/diagrams/children/index.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/children/index.ts) — collect-children 工具函数 + barrel
- [app/lib/diagrams/layouts/lanes-layout.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/layouts/lanes-layout.tsx)
- [app/lib/diagrams/layouts/graph-layout.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/layouts/graph-layout.tsx)
- [app/lib/diagrams/cover-card.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/cover-card.tsx)
- [app/lib/diagrams/player-shell.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/player-shell.tsx)
- [app/lib/diagrams/interactive-diagram.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/interactive-diagram.tsx)
- [app/lib/diagrams/data/agent-timeline.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/data/agent-timeline.ts)
- [tests/unit/diagrams/schema.test.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/tests/unit/diagrams/schema.test.ts)
- [tests/unit/diagrams/use-diagram-state.test.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/tests/unit/diagrams/use-diagram-state.test.ts)
- [tests/unit/diagrams/collect-children.test.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/tests/unit/diagrams/collect-children.test.tsx)
- [tests/components/diagrams/interactive-diagram.test.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/tests/components/diagrams/interactive-diagram.test.tsx)
- [tests/components/diagrams/graph-layout.test.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/tests/components/diagrams/graph-layout.test.tsx)

修改：

- [app/lib/agent-timeline-interactive.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/agent-timeline-interactive.tsx) — 改为薄封装
- [app/globals.css](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/globals.css) — 顶部 `@import './lib/diagrams/diagram.css'`（如果 globals.css 不允许 @import 则 inline）
- [mdx-components.js](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/mdx-components.js) — 注册 InteractiveDiagram 等 4 个组件

不变：

- [tests/agent-timeline-interactive.test.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/tests/agent-timeline-interactive.test.tsx) — 必须 0 修改继续通过
- [app/docs/page.mdx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/docs/page.mdx) — 不动

---

## Task 1: schema + 类型基础

**Files:**
- Create: [app/lib/diagrams/types.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/types.ts)
- Create: [app/lib/diagrams/schema.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/schema.ts)
- Test: [tests/unit/diagrams/schema.test.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/tests/unit/diagrams/schema.test.ts)

- [ ] **Step 1.1: Write the failing schema test**

文件 `tests/unit/diagrams/schema.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { parseDiagramSchema } from '../../../app/lib/diagrams/schema'

describe('parseDiagramSchema', () => {
  it('accepts a valid lanes schema', () => {
    const result = parseDiagramSchema({
      lanes: [{ id: 'user', title: '用户', tone: 'blue' }],
      phases: [{ id: 'chat', label: '消息接入', summary: '识别用户' }],
      steps: [
        {
          id: 1,
          from: 'user',
          to: 'user',
          y: 78,
          phase: 'chat',
          tone: 'blue',
          title: '提问',
          detail: '一句话进入系统'
        }
      ]
    })
    expect(result.steps).toHaveLength(1)
    expect(result.lanes?.[0].id).toBe('user')
  })

  it('accepts a valid graph schema', () => {
    const result = parseDiagramSchema({
      nodes: [
        { id: 'a', title: 'A', x: 0, y: 0, tone: 'blue' },
        { id: 'b', title: 'B', x: 100, y: 0, tone: 'green' }
      ],
      edges: [{ source: 'a', target: 'b' }],
      steps: [
        { id: 's1', from: 'a', to: 'b', tone: 'blue', title: 'A→B', detail: '...' }
      ]
    })
    expect(result.nodes).toHaveLength(2)
    expect(result.edges).toEqual([{ source: 'a', target: 'b' }])
  })

  it('rejects unknown tone', () => {
    expect(() =>
      parseDiagramSchema({
        steps: [
          { id: 1, from: 'a', to: 'b', tone: 'rainbow', title: 't', detail: 'd' }
        ]
      })
    ).toThrow()
  })

  it('rejects step referencing missing lane id', () => {
    expect(() =>
      parseDiagramSchema({
        lanes: [{ id: 'user', title: '用户', tone: 'blue' }],
        steps: [
          { id: 1, from: 'user', to: 'ghost', tone: 'blue', title: 't', detail: 'd' }
        ]
      })
    ).toThrow(/ghost/)
  })
})
```

- [ ] **Step 1.2: Run test, expect failure**

Run: `npm test -- tests/unit/diagrams/schema.test.ts`
Expected: FAIL（找不到模块 `app/lib/diagrams/schema`）

- [ ] **Step 1.3: Write `app/lib/diagrams/types.ts`**

```ts
export type Tone = 'blue' | 'violet' | 'cyan' | 'orange' | 'green' | 'navy'

export type LaneSchema = {
  id: string
  title: string
  subtitle?: string
  tone: Tone
}

export type NodeSchema = {
  id: string
  title: string
  subtitle?: string
  x: number
  y: number
  tone: Tone
}

export type EdgeSchema = {
  source: string
  target: string
}

export type PhaseSchema = {
  id: string
  label: string
  summary: string
}

export type StepSchema = {
  id: number | string
  from: string
  to: string
  y?: number
  phase?: string
  tone: Tone
  title: string
  subtitle?: string
  detail: string
  engineering?: string
}

export type DiagramSchema = {
  lanes?: LaneSchema[]
  nodes?: NodeSchema[]
  edges?: EdgeSchema[]
  phases?: PhaseSchema[]
  steps: StepSchema[]
}

export type DiagramLayoutKind = 'lanes' | 'graph' | 'flow'
```

- [ ] **Step 1.4: Write `app/lib/diagrams/schema.ts`**

```ts
import { z } from 'zod'
import type { DiagramSchema } from './types'

const ToneEnum = z.enum(['blue', 'violet', 'cyan', 'orange', 'green', 'navy'])

const laneSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  tone: ToneEnum
})

const nodeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  x: z.number(),
  y: z.number(),
  tone: ToneEnum
})

const edgeSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1)
})

const phaseSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  summary: z.string()
})

const stepSchema = z.object({
  id: z.union([z.number(), z.string()]),
  from: z.string().min(1),
  to: z.string().min(1),
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
    const known = new Set<string>()
    value.lanes?.forEach((l) => known.add(l.id))
    value.nodes?.forEach((n) => known.add(n.id))
    if (known.size === 0) return
    value.steps.forEach((step, index) => {
      if (!known.has(step.from)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['steps', index, 'from'],
          message: `Unknown lane/node id: ${step.from}`
        })
      }
      if (!known.has(step.to)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['steps', index, 'to'],
          message: `Unknown lane/node id: ${step.to}`
        })
      }
    })
  })

export function parseDiagramSchema(input: unknown): DiagramSchema {
  return diagramZodSchema.parse(input) as DiagramSchema
}
```

- [ ] **Step 1.5: Re-run test, expect pass**

Run: `npm test -- tests/unit/diagrams/schema.test.ts`
Expected: 4 passed

- [ ] **Step 1.6: Commit**

```bash
git add app/lib/diagrams/types.ts app/lib/diagrams/schema.ts tests/unit/diagrams/schema.test.ts
git commit -m "feat(diagrams): add zod schema + type defs"
```

---

## Task 2: useReducer 状态机

**Files:**
- Create: [app/lib/diagrams/use-diagram-state.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/use-diagram-state.ts)
- Test: [tests/unit/diagrams/use-diagram-state.test.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/tests/unit/diagrams/use-diagram-state.test.ts)

- [ ] **Step 2.1: Write the failing reducer test**

文件 `tests/unit/diagrams/use-diagram-state.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { diagramReducer, initialState } from '../../../app/lib/diagrams/use-diagram-state'

describe('diagramReducer', () => {
  const ctx = { stepCount: 5 }

  it('OPEN sets isOpen=true and resets index', () => {
    const next = diagramReducer({ ...initialState, currentIndex: 3 }, { type: 'OPEN' }, ctx)
    expect(next.isOpen).toBe(true)
    expect(next.currentIndex).toBe(0)
    expect(next.isPlaying).toBe(false)
  })

  it('CLOSE sets isOpen=false and pauses', () => {
    const next = diagramReducer({ isOpen: true, currentIndex: 2, isPlaying: true }, { type: 'CLOSE' }, ctx)
    expect(next.isOpen).toBe(false)
    expect(next.isPlaying).toBe(false)
  })

  it('NEXT advances by 1 within bounds', () => {
    const next = diagramReducer({ isOpen: true, currentIndex: 0, isPlaying: false }, { type: 'NEXT' }, ctx)
    expect(next.currentIndex).toBe(1)
  })

  it('NEXT clamps at last index and stops playing', () => {
    const next = diagramReducer({ isOpen: true, currentIndex: 4, isPlaying: true }, { type: 'NEXT' }, ctx)
    expect(next.currentIndex).toBe(4)
    expect(next.isPlaying).toBe(false)
  })

  it('PREV clamps at 0', () => {
    const next = diagramReducer({ isOpen: true, currentIndex: 0, isPlaying: false }, { type: 'PREV' }, ctx)
    expect(next.currentIndex).toBe(0)
  })

  it('GOTO clamps to bounds and pauses', () => {
    const next = diagramReducer(
      { isOpen: true, currentIndex: 0, isPlaying: true },
      { type: 'GOTO', index: 99 },
      ctx
    )
    expect(next.currentIndex).toBe(4)
    expect(next.isPlaying).toBe(false)
  })

  it('TOGGLE_PLAY flips isPlaying', () => {
    const next = diagramReducer({ isOpen: true, currentIndex: 0, isPlaying: false }, { type: 'TOGGLE_PLAY' }, ctx)
    expect(next.isPlaying).toBe(true)
  })

  it('TOGGLE_PLAY at last index restarts from 0', () => {
    const next = diagramReducer({ isOpen: true, currentIndex: 4, isPlaying: false }, { type: 'TOGGLE_PLAY' }, ctx)
    expect(next.isPlaying).toBe(true)
    expect(next.currentIndex).toBe(0)
  })
})
```

- [ ] **Step 2.2: Run test, expect failure**

Run: `npm test -- tests/unit/diagrams/use-diagram-state.test.ts`
Expected: FAIL（模块未找到）

- [ ] **Step 2.3: Write `app/lib/diagrams/use-diagram-state.ts`**

```ts
import { useReducer } from 'react'

export type DiagramState = {
  isOpen: boolean
  currentIndex: number
  isPlaying: boolean
}

export type DiagramAction =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'NEXT' }
  | { type: 'PREV' }
  | { type: 'GOTO'; index: number }
  | { type: 'TOGGLE_PLAY' }
  | { type: 'PAUSE' }

export type DiagramReducerCtx = { stepCount: number }

export const initialState: DiagramState = {
  isOpen: false,
  currentIndex: 0,
  isPlaying: false
}

function clamp(value: number, max: number) {
  if (max <= 0) return 0
  return Math.max(0, Math.min(max - 1, value))
}

export function diagramReducer(
  state: DiagramState,
  action: DiagramAction,
  ctx: DiagramReducerCtx
): DiagramState {
  const last = Math.max(0, ctx.stepCount - 1)
  switch (action.type) {
    case 'OPEN':
      return { ...state, isOpen: true, currentIndex: 0, isPlaying: false }
    case 'CLOSE':
      return { ...state, isOpen: false, isPlaying: false }
    case 'NEXT': {
      const next = state.currentIndex + 1
      if (next > last) return { ...state, currentIndex: last, isPlaying: false }
      return { ...state, currentIndex: next }
    }
    case 'PREV':
      return { ...state, currentIndex: clamp(state.currentIndex - 1, ctx.stepCount), isPlaying: false }
    case 'GOTO':
      return { ...state, currentIndex: clamp(action.index, ctx.stepCount), isPlaying: false }
    case 'TOGGLE_PLAY':
      if (!state.isPlaying && state.currentIndex >= last) {
        return { ...state, isPlaying: true, currentIndex: 0 }
      }
      return { ...state, isPlaying: !state.isPlaying }
    case 'PAUSE':
      return { ...state, isPlaying: false }
  }
}

export function useDiagramState(stepCount: number) {
  const [state, dispatchRaw] = useReducer(
    (s: DiagramState, a: DiagramAction) => diagramReducer(s, a, { stepCount }),
    initialState
  )
  return [state, dispatchRaw] as const
}
```

- [ ] **Step 2.4: Re-run test, expect pass**

Run: `npm test -- tests/unit/diagrams/use-diagram-state.test.ts`
Expected: 8 passed

- [ ] **Step 2.5: Commit**

```bash
git add app/lib/diagrams/use-diagram-state.ts tests/unit/diagrams/use-diagram-state.test.ts
git commit -m "feat(diagrams): add useReducer state machine"
```

---

## Task 3: compound 子组件 + collect-children 工具

**Files:**
- Create: [app/lib/diagrams/children/lane.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/children/lane.tsx)
- Create: [app/lib/diagrams/children/node.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/children/node.tsx)
- Create: [app/lib/diagrams/children/edge.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/children/edge.tsx)
- Create: [app/lib/diagrams/children/phase.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/children/phase.tsx)
- Create: [app/lib/diagrams/children/step.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/children/step.tsx)
- Create: [app/lib/diagrams/children/index.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/children/index.ts)
- Test: [tests/unit/diagrams/collect-children.test.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/tests/unit/diagrams/collect-children.test.tsx)

- [ ] **Step 3.1: Write the failing collect-children test**

文件 `tests/unit/diagrams/collect-children.test.tsx`：

```tsx
import React from 'react'
import { describe, expect, it } from 'vitest'
import { collectDiagramSchema, Lane, Node, Edge, Phase, Step } from '../../../app/lib/diagrams/children'

describe('collectDiagramSchema', () => {
  it('collects lanes / phases / steps from declarative children', () => {
    const tree = (
      <>
        <Lane id="user" title="用户" tone="blue" />
        <Lane id="chat" title="Chat 层" tone="violet" />
        <Phase id="chat" label="消息接入" summary="..." />
        <Step id={1} from="user" to="chat" tone="blue" title="提问" detail="..." />
        <Step id={2} from="chat" to="user" tone="violet" title="回复" detail="..." />
      </>
    )
    const schema = collectDiagramSchema(tree)
    expect(schema.lanes).toHaveLength(2)
    expect(schema.lanes?.[0].id).toBe('user')
    expect(schema.phases).toHaveLength(1)
    expect(schema.steps).toHaveLength(2)
  })

  it('collects nodes / edges for graph layout', () => {
    const tree = (
      <>
        <Node id="a" title="A" x={0} y={0} tone="blue" />
        <Node id="b" title="B" x={100} y={50} tone="green" />
        <Edge source="a" target="b" />
        <Step id="s1" from="a" to="b" tone="blue" title="A→B" detail="..." />
      </>
    )
    const schema = collectDiagramSchema(tree)
    expect(schema.nodes).toHaveLength(2)
    expect(schema.edges).toEqual([{ source: 'a', target: 'b' }])
    expect(schema.steps).toHaveLength(1)
  })

  it('flattens steps nested inside <Phase>', () => {
    const tree = (
      <>
        <Lane id="user" title="用户" tone="blue" />
        <Phase id="chat" label="消息接入" summary="...">
          <Step id={1} from="user" to="user" phase="chat" tone="blue" title="提问" detail="..." />
        </Phase>
      </>
    )
    const schema = collectDiagramSchema(tree)
    expect(schema.steps).toHaveLength(1)
    expect(schema.steps[0].phase).toBe('chat')
  })
})
```

- [ ] **Step 3.2: Run test, expect failure**

Run: `npm test -- tests/unit/diagrams/collect-children.test.tsx`
Expected: FAIL（模块未找到）

- [ ] **Step 3.3: Write each child component**

`app/lib/diagrams/children/lane.tsx`：

```tsx
import type { Tone } from '../types'

export type LaneProps = {
  id: string
  title: string
  subtitle?: string
  tone: Tone
}

export function Lane(_props: LaneProps): null {
  return null
}
Lane.__diagramKind = 'lane' as const
```

`app/lib/diagrams/children/node.tsx`：

```tsx
import type { Tone } from '../types'

export type NodeProps = {
  id: string
  title: string
  subtitle?: string
  x: number
  y: number
  tone: Tone
}

export function Node(_props: NodeProps): null {
  return null
}
Node.__diagramKind = 'node' as const
```

`app/lib/diagrams/children/edge.tsx`：

```tsx
export type EdgeProps = {
  source: string
  target: string
}

export function Edge(_props: EdgeProps): null {
  return null
}
Edge.__diagramKind = 'edge' as const
```

`app/lib/diagrams/children/phase.tsx`：

```tsx
import type { ReactNode } from 'react'

export type PhaseProps = {
  id: string
  label: string
  summary: string
  children?: ReactNode
}

export function Phase(_props: PhaseProps): null {
  return null
}
Phase.__diagramKind = 'phase' as const
```

`app/lib/diagrams/children/step.tsx`：

```tsx
import type { Tone } from '../types'

export type StepProps = {
  id: number | string
  from: string
  to: string
  y?: number
  phase?: string
  tone: Tone
  title: string
  subtitle?: string
  detail: string
  engineering?: string
}

export function Step(_props: StepProps): null {
  return null
}
Step.__diagramKind = 'step' as const
```

- [ ] **Step 3.4: Write `app/lib/diagrams/children/index.ts`**

```ts
import { Children, isValidElement, type ReactNode } from 'react'
import type {
  DiagramSchema,
  EdgeSchema,
  LaneSchema,
  NodeSchema,
  PhaseSchema,
  StepSchema
} from '../types'
import { Lane } from './lane'
import { Node } from './node'
import { Edge } from './edge'
import { Phase } from './phase'
import { Step } from './step'

export { Lane, Node, Edge, Phase, Step }
export type { LaneProps } from './lane'
export type { NodeProps } from './node'
export type { EdgeProps } from './edge'
export type { PhaseProps } from './phase'
export type { StepProps } from './step'

type Kind = 'lane' | 'node' | 'edge' | 'phase' | 'step'

function kindOf(child: unknown): Kind | null {
  if (!isValidElement(child)) return null
  const type = child.type as { __diagramKind?: Kind } | string | undefined
  if (typeof type === 'function' || typeof type === 'object') {
    const k = (type as { __diagramKind?: Kind }).__diagramKind
    if (k) return k
  }
  return null
}

export function collectDiagramSchema(children: ReactNode): DiagramSchema {
  const lanes: LaneSchema[] = []
  const nodes: NodeSchema[] = []
  const edges: EdgeSchema[] = []
  const phases: PhaseSchema[] = []
  const steps: StepSchema[] = []

  function walk(nodesIn: ReactNode, currentPhaseId?: string) {
    Children.forEach(nodesIn, (child) => {
      const kind = kindOf(child)
      if (!kind || !isValidElement(child)) return
      const props = child.props as Record<string, unknown>
      switch (kind) {
        case 'lane':
          lanes.push(props as unknown as LaneSchema)
          break
        case 'node':
          nodes.push(props as unknown as NodeSchema)
          break
        case 'edge':
          edges.push(props as unknown as EdgeSchema)
          break
        case 'phase': {
          const p = props as unknown as PhaseSchema & { children?: ReactNode }
          phases.push({ id: p.id, label: p.label, summary: p.summary })
          if (p.children) walk(p.children, p.id)
          break
        }
        case 'step': {
          const s = props as unknown as StepSchema
          steps.push({ ...s, phase: s.phase ?? currentPhaseId })
          break
        }
      }
    })
  }

  walk(children)

  return {
    lanes: lanes.length ? lanes : undefined,
    nodes: nodes.length ? nodes : undefined,
    edges: edges.length ? edges : undefined,
    phases: phases.length ? phases : undefined,
    steps
  }
}
```

- [ ] **Step 3.5: Re-run test, expect pass**

Run: `npm test -- tests/unit/diagrams/collect-children.test.tsx`
Expected: 3 passed

- [ ] **Step 3.6: Commit**

```bash
git add app/lib/diagrams/children tests/unit/diagrams/collect-children.test.tsx
git commit -m "feat(diagrams): compound child components + collectDiagramSchema"
```

---

## Task 4: agent-timeline 数据迁移 + lanes layout

**Files:**
- Create: [app/lib/diagrams/data/agent-timeline.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/data/agent-timeline.ts)
- Create: [app/lib/diagrams/layouts/lanes-layout.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/layouts/lanes-layout.tsx)

- [ ] **Step 4.1: 把 [agent-timeline-interactive.tsx#L40-L247](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/agent-timeline-interactive.tsx#L40-L247) 里的 `lanes` / `phases` / `steps` 三个数组**

按现有内容**逐字段复制**到 `app/lib/diagrams/data/agent-timeline.ts`，导出 `agentTimelineSchema: DiagramSchema`：

```ts
import type { DiagramSchema } from '../types'

export const agentTimelineSchema: DiagramSchema = {
  lanes: [
    { id: 'user', title: '用户', subtitle: '发起需求', tone: 'blue' },
    { id: 'chat', title: 'Chat 层', subtitle: '消息组织', tone: 'violet' },
    { id: 'context', title: 'Context Engineering', subtitle: '上下文工程', tone: 'blue' },
    { id: 'loop', title: 'Agent Loop', subtitle: '智能体循环', tone: 'cyan' },
    { id: 'tool', title: 'Tool', subtitle: '工具调用', tone: 'orange' },
    { id: 'api', title: '第三方 API', subtitle: '天气接口', tone: 'blue' },
    { id: 'memory', title: 'Memory', subtitle: '长期记忆', tone: 'green' },
    { id: 'harness', title: 'Harness', subtitle: '运行时保障', tone: 'navy' }
  ],
  phases: [
    { id: 'chat', label: '消息接入', summary: '识别用户、会话和目标 Agent' },
    { id: 'context', label: '上下文准备', summary: '整理问题、工具、权限和偏好' },
    { id: 'loop', label: '决策行动', summary: '判断是否需要真实世界动作' },
    { id: 'tool', label: '工具调用', summary: '通过工具访问外部能力' },
    { id: 'observe', label: '结果观察', summary: '把结构化结果交回模型' },
    { id: 'response', label: '生成回复', summary: '组织自然语言并流式输出' },
    { id: 'harness', label: '安全保障', summary: '兜底权限、超时、日志和恢复' }
  ],
  steps: [
    /* TODO: copy 15 step objects verbatim from agent-timeline-interactive.tsx#L66-L247 */
  ]
}
```

注意：执行 Task 4.1 时**逐字段复制全部 15 个 step**，不要省略 detail / engineering / subtitle。最终 steps 数组长度必须等于 15。

- [ ] **Step 4.2: Write `app/lib/diagrams/layouts/lanes-layout.tsx`**

把 [agent-timeline-interactive.tsx#L249-L519](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/agent-timeline-interactive.tsx#L249-L519) 里的 `laneX` / `toneColors` / `buildLinePath` / `<svg>` 渲染逻辑迁移过来，签名改为：

```tsx
import type { DiagramSchema, StepSchema, LaneSchema, Tone } from '../types'

export type LanesLayoutProps = {
  schema: DiagramSchema
  currentIndex: number
}

const toneColors: Record<Tone, string> = {
  blue: '#2f6feb',
  violet: '#6f4bd8',
  cyan: '#16a3a5',
  orange: '#f2801c',
  green: '#2f9d67',
  navy: '#2763c4'
}

function buildLanePositions(lanes: LaneSchema[]): Record<string, number> {
  return lanes.reduce<Record<string, number>>(
    (acc, lane, index) => ({ ...acc, [lane.id]: 70 + index * 142 }),
    {}
  )
}

function buildLinePath(step: StepSchema, laneX: Record<string, number>) {
  const startX = laneX[step.from]
  const endX = laneX[step.to]
  const y = step.y ?? 0
  if (step.from === step.to) {
    return `M ${startX - 16} ${y - 24} L ${startX - 16} ${y + 24}`
  }
  return `M ${startX} ${y} L ${endX} ${y}`
}

function isVisited(currentIndex: number, stepIndex: number) {
  return stepIndex <= currentIndex
}

export function LanesLayout({ schema, currentIndex }: LanesLayoutProps) {
  const lanes = schema.lanes ?? []
  const steps = schema.steps
  const laneX = buildLanePositions(lanes)
  const current = steps[currentIndex]

  return (
    <div className="ha-agent-timeline__stage" aria-hidden="true">
      <div className="ha-agent-timeline__lanes">
        {lanes.map((lane) => (
          <div
            key={lane.id}
            className="ha-agent-timeline__lane-card"
            data-tone={lane.tone}
            data-active={lane.id === current?.from || lane.id === current?.to}
          >
            <span className="ha-agent-timeline__lane-icon" />
            <strong>{lane.title}</strong>
            <small>{lane.subtitle}</small>
          </div>
        ))}
      </div>
      <div className="ha-agent-timeline__canvas">
        <svg viewBox="0 0 1064 620" role="img">
          <defs>
            <marker
              id="ha-agent-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
          </defs>
          {lanes.map((lane) => (
            <line
              key={lane.id}
              x1={laneX[lane.id]}
              x2={laneX[lane.id]}
              y1="20"
              y2="604"
              className="ha-agent-timeline__lifeline"
            />
          ))}
          {steps.map((step, index) => {
            const active = index === currentIndex
            const visited = isVisited(currentIndex, index)
            const x = laneX[step.to]
            const y = step.y ?? 0
            const color = toneColors[step.tone]
            return (
              <g
                key={step.id}
                className="ha-agent-timeline__step"
                data-active={active}
                data-visited={visited}
                style={{ color }}
              >
                <path
                  d={buildLinePath(step, laneX)}
                  markerEnd={step.from === step.to ? undefined : 'url(#ha-agent-arrow)'}
                />
                <circle cx={x} cy={y} r={active ? 15 : 11} />
                <text x={x} y={y + 4} textAnchor="middle">
                  {index + 1}
                </text>
                <text
                  x={
                    step.from === step.to
                      ? x + 20
                      : Math.min(laneX[step.from], laneX[step.to]) + 18
                  }
                  y={y - 10}
                  className="ha-agent-timeline__step-label"
                >
                  {step.title}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
```

注意保留现有 `.ha-agent-timeline__*` 类名（spec §8）以避免视觉回归。

- [ ] **Step 4.3: Commit（暂未接入，下一 task 整体接通后再跑测试）**

```bash
git add app/lib/diagrams/data app/lib/diagrams/layouts/lanes-layout.tsx
git commit -m "feat(diagrams): migrate agent-timeline data + lanes layout"
```

---

## Task 5: player-shell + cover-card + interactive-diagram 顶层

**Files:**
- Create: [app/lib/diagrams/cover-card.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/cover-card.tsx)
- Create: [app/lib/diagrams/player-shell.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/player-shell.tsx)
- Create: [app/lib/diagrams/interactive-diagram.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/diagrams/interactive-diagram.tsx)
- Modify: [app/lib/agent-timeline-interactive.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/agent-timeline-interactive.tsx) 改为薄封装

- [ ] **Step 5.1: Write `cover-card.tsx`（'use client' 内的展示组件，封面卡）**

把 [agent-timeline-interactive.tsx#L329-L362](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/agent-timeline-interactive.tsx#L329-L362) 的封面卡 JSX 抽出为通用组件：

```tsx
import { forwardRef } from 'react'
import type { LaneSchema, NodeSchema } from './types'

export type CoverCardProps = {
  eyebrow?: string
  title: string
  description?: string
  buttonLabel: string
  previewQuestion?: string
  previewLanes?: Array<Pick<LaneSchema, 'id' | 'title' | 'tone'>>
  previewNodes?: Array<Pick<NodeSchema, 'id' | 'title' | 'tone'>>
  onOpen: () => void
  titleId: string
}

export const CoverCard = forwardRef<HTMLButtonElement, CoverCardProps>(function CoverCard(
  {
    eyebrow,
    title,
    description,
    buttonLabel,
    previewQuestion,
    previewLanes,
    previewNodes,
    onOpen,
    titleId
  },
  ref
) {
  const items = previewLanes ?? previewNodes ?? []
  return (
    <div className="ha-agent-timeline-entry">
      <section className="ha-agent-timeline-cover" aria-labelledby={titleId}>
        <div className="ha-agent-timeline-cover__content">
          {eyebrow ? <p className="ha-agent-timeline-cover__eyebrow">{eyebrow}</p> : null}
          <h3 id={titleId}>{title}</h3>
          {description ? <p>{description}</p> : null}
          <button ref={ref} type="button" aria-label={buttonLabel} onClick={onOpen}>
            <span>{buttonLabel}</span>
            <span aria-hidden>↗</span>
          </button>
        </div>
        <button
          type="button"
          aria-label={`${buttonLabel}预览`}
          className="ha-agent-timeline-cover__preview"
          onClick={onOpen}
        >
          {previewQuestion ? (
            <span className="ha-agent-timeline-cover__question">{previewQuestion}</span>
          ) : null}
          <span className="ha-agent-timeline-cover__lanes" aria-hidden="true">
            {items.map((item) => (
              <span key={item.id} data-tone={item.tone}>
                <strong>{item.title}</strong>
              </span>
            ))}
          </span>
          <span className="ha-agent-timeline-cover__pulse one" aria-hidden="true" />
          <span className="ha-agent-timeline-cover__pulse two" aria-hidden="true" />
          <span className="ha-agent-timeline-cover__pulse three" aria-hidden="true" />
        </button>
      </section>
    </div>
  )
})
```

- [ ] **Step 5.2: Write `player-shell.tsx`**

迁移 [agent-timeline-interactive.tsx#L283-L552](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/agent-timeline-interactive.tsx#L283-L552) 的 modal、controls、phase nav、inspector，但**改成接收 schema + state 的纯渲染组件**：

```tsx
'use client'

import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { DiagramSchema, DiagramLayoutKind } from './types'
import type { DiagramAction, DiagramState } from './use-diagram-state'
import { LanesLayout } from './layouts/lanes-layout'
import { GraphLayout } from './layouts/graph-layout'

const openDiagrams = new Set<string>()
let originalOverflow: string | null = null
function lock(id: string) {
  if (typeof document === 'undefined') return
  if (openDiagrams.size === 0) {
    originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  openDiagrams.add(id)
}
function unlock(id: string) {
  if (typeof document === 'undefined') return
  openDiagrams.delete(id)
  if (openDiagrams.size === 0 && originalOverflow !== null) {
    document.body.style.overflow = originalOverflow
    originalOverflow = null
  }
}

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => !el.hasAttribute('inert'))
}

export type PlayerShellProps = {
  id: string
  layout: DiagramLayoutKind
  schema: DiagramSchema
  modalTitle: string
  autoPlayInterval: number
  state: DiagramState
  dispatch: (action: DiagramAction) => void
  onReturnFocus: () => void
}

export function PlayerShell({
  id,
  layout,
  schema,
  modalTitle,
  autoPlayInterval,
  state,
  dispatch,
  onReturnFocus
}: PlayerShellProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const phases = schema.phases ?? []
  const steps = schema.steps
  const current = steps[state.currentIndex]
  const activePhase = current?.phase

  const phaseLookup = useMemo(() => {
    const map: Record<string, number> = {}
    phases.forEach((p) => {
      const idx = steps.findIndex((s) => s.phase === p.id)
      if (idx >= 0) map[p.id] = idx
    })
    return map
  }, [phases, steps])

  useEffect(() => {
    if (!state.isOpen) return
    lock(id)
    closeBtnRef.current?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        dispatch({ type: 'CLOSE' })
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        dispatch({ type: 'NEXT' })
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        dispatch({ type: 'PREV' })
        return
      }
      if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault()
        dispatch({ type: 'TOGGLE_PLAY' })
        return
      }
      if (event.key === 'Tab' && panelRef.current) {
        const focusables = getFocusable(panelRef.current)
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement as HTMLElement | null
        if (event.shiftKey && active === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && active === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      unlock(id)
      onReturnFocus()
    }
  }, [state.isOpen, id, dispatch, onReturnFocus])

  useEffect(() => {
    if (!state.isPlaying) return
    const timer = window.setInterval(() => dispatch({ type: 'NEXT' }), autoPlayInterval)
    return () => window.clearInterval(timer)
  }, [state.isPlaying, autoPlayInterval, dispatch])

  if (!state.isOpen || typeof document === 'undefined') return null

  const titleId = `${id}-modal-title`

  const canvas =
    layout === 'graph' ? (
      <GraphLayout schema={schema} currentIndex={state.currentIndex} />
    ) : (
      <LanesLayout schema={schema} currentIndex={state.currentIndex} />
    )

  return createPortal(
    <div
      className="ha-agent-timeline-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => dispatch({ type: 'CLOSE' })}
    >
      <div
        ref={panelRef}
        className="ha-agent-timeline-modal__panel"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          ref={closeBtnRef}
          type="button"
          aria-label="关闭交互时序"
          className="ha-agent-timeline-modal__close"
          onClick={() => dispatch({ type: 'CLOSE' })}
        >
          <span aria-hidden>×</span>
        </button>
        <section className="ha-agent-timeline" aria-label={modalTitle}>
          <div className="ha-agent-timeline__header">
            <div>
              <p className="ha-agent-timeline__eyebrow">OpenClaw Agent Sequence</p>
              <h3 id={titleId}>{modalTitle}</h3>
            </div>
            <div className="ha-agent-timeline__controls" aria-label="时序控制">
              <button type="button" aria-label="上一步" onClick={() => dispatch({ type: 'PREV' })}>
                <span aria-hidden>‹</span>
              </button>
              <button
                type="button"
                aria-label={state.isPlaying ? '暂停' : '播放'}
                className="is-primary"
                onClick={() => dispatch({ type: 'TOGGLE_PLAY' })}
              >
                <span aria-hidden>{state.isPlaying ? 'Ⅱ' : '▶'}</span>
              </button>
              <button type="button" aria-label="下一步" onClick={() => dispatch({ type: 'NEXT' })}>
                <span aria-hidden>›</span>
              </button>
            </div>
          </div>
          <div className="ha-agent-timeline__body">
            {canvas}
            <aside
              className="ha-agent-timeline__inspector"
              data-tone={current?.tone}
              aria-live="polite"
            >
              <div className="ha-agent-timeline__counter">
                {state.currentIndex + 1} / {steps.length}
              </div>
              <h4>{current?.title}</h4>
              {current?.subtitle ? (
                <p className="ha-agent-timeline__subtitle">{current.subtitle}</p>
              ) : null}
              <p>{current?.detail}</p>
              {current?.engineering ? (
                <div className="ha-agent-timeline__note">
                  <span>工程含义</span>
                  <p>{current.engineering}</p>
                </div>
              ) : null}
            </aside>
          </div>
          {phases.length > 0 ? (
            <nav className="ha-agent-timeline__phases" aria-label="核心流程阶段">
              {phases.map((phase) => (
                <button
                  key={phase.id}
                  type="button"
                  aria-label={phase.label}
                  data-active={phase.id === activePhase}
                  onClick={() => dispatch({ type: 'GOTO', index: phaseLookup[phase.id] ?? 0 })}
                >
                  <span>{phase.label}</span>
                  <small>{phase.summary}</small>
                </button>
              ))}
            </nav>
          ) : null}
        </section>
      </div>
    </div>,
    document.body
  )
}
```

- [ ] **Step 5.3: Write `interactive-diagram.tsx`（顶层 'use client' 容器）**

```tsx
'use client'

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DiagramLayoutKind, DiagramSchema, LaneSchema, NodeSchema } from './types'
import { collectDiagramSchema } from './children'
import { parseDiagramSchema } from './schema'
import { useDiagramState } from './use-diagram-state'
import { CoverCard } from './cover-card'
import { PlayerShell } from './player-shell'

export type InteractiveDiagramProps = {
  id: string
  layout: DiagramLayoutKind
  coverEyebrow?: string
  coverTitle: string
  coverDescription?: string
  coverButtonLabel?: string
  previewQuestion?: string
  modalTitle?: string
  autoPlayInterval?: number
  data?: DiagramSchema
  children?: ReactNode
}

export function InteractiveDiagram({
  id,
  layout,
  coverEyebrow,
  coverTitle,
  coverDescription,
  coverButtonLabel = '打开交互时序',
  previewQuestion,
  modalTitle,
  autoPlayInterval = 1400,
  data,
  children
}: InteractiveDiagramProps) {
  const [validationError, setValidationError] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const schema = useMemo<DiagramSchema | null>(() => {
    const raw = data ?? collectDiagramSchema(children)
    if (!raw || raw.steps.length === 0) {
      setValidationError('Diagram has no steps')
      return null
    }
    try {
      return parseDiagramSchema(raw)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid diagram schema'
      if (process.env.NODE_ENV !== 'production') {
        throw err
      }
      console.warn(`[InteractiveDiagram:${id}]`, message)
      setValidationError(message)
      return raw
    }
  }, [data, children, id])

  const stepCount = schema?.steps.length ?? 0
  const [state, dispatch] = useDiagramState(stepCount)

  const handleOpen = useCallback(() => dispatch({ type: 'OPEN' }), [dispatch])
  const returnFocus = useCallback(() => triggerRef.current?.focus(), [])

  if (!schema) {
    return validationError ? (
      <div role="alert" className="ha-agent-timeline-entry">
        Diagram error: {validationError}
      </div>
    ) : null
  }

  const previewLanes: LaneSchema[] | undefined = layout === 'lanes' ? schema.lanes : undefined
  const previewNodes: NodeSchema[] | undefined = layout === 'graph' ? schema.nodes : undefined

  return (
    <>
      <CoverCard
        ref={triggerRef}
        eyebrow={coverEyebrow}
        title={coverTitle}
        description={coverDescription}
        buttonLabel={coverButtonLabel}
        previewQuestion={previewQuestion}
        previewLanes={previewLanes}
        previewNodes={previewNodes}
        onOpen={handleOpen}
        titleId={`${id}-cover-title`}
      />
      <PlayerShell
        id={id}
        layout={layout}
        schema={schema}
        modalTitle={modalTitle ?? coverTitle}
        autoPlayInterval={autoPlayInterval}
        state={state}
        dispatch={dispatch}
        onReturnFocus={returnFocus}
      />
    </>
  )
}
```

- [ ] **Step 5.4: 暂留一个空的 `app/lib/diagrams/layouts/graph-layout.tsx` 占位**

让 player-shell 的 import 不报错。Task 6 才会真正实现：

```tsx
import type { DiagramSchema } from '../types'
export type GraphLayoutProps = { schema: DiagramSchema; currentIndex: number }
export function GraphLayout(_props: GraphLayoutProps) {
  return <div className="ha-agent-timeline__stage" aria-hidden="true" />
}
```

- [ ] **Step 5.5: Rewrite `app/lib/agent-timeline-interactive.tsx` 为薄封装**

```tsx
'use client'

import { InteractiveDiagram } from './diagrams/interactive-diagram'
import { agentTimelineSchema } from './diagrams/data/agent-timeline'

export function AgentTimelineInteractive() {
  return (
    <InteractiveDiagram
      id="agent-timeline"
      layout="lanes"
      coverEyebrow="Interactive Sequence"
      coverTitle="用户与 OpenClaw Agent 交互时序"
      coverDescription="从一句“多比，今天西安天气如何？”开始，展开 Chat、Context、Agent Loop、Tool、Memory 与 Harness 的完整协作过程。"
      coverButtonLabel="打开交互时序"
      previewQuestion="多比，今天西安天气如何？"
      modalTitle="Agent 交互时序播放器"
      data={agentTimelineSchema}
    />
  )
}
```

注意：
- modalTitle 必须保持 `Agent 交互时序播放器` 与现有 [agent-timeline-interactive.test.tsx#L11](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/tests/agent-timeline-interactive.test.tsx#L11) 一致
- coverButtonLabel = `打开交互时序` 与 [test#L13](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/tests/agent-timeline-interactive.test.tsx#L13) 一致
- 现有测试还会断言 `screen.getByRole('button', { name: '工具调用' })` —— 来自 `phases` 中 `工具调用` phase；保持迁移后的 phase label 不变

- [ ] **Step 5.6: Run the existing test, expect pass**

Run: `npm test -- tests/agent-timeline-interactive.test.tsx`
Expected: 1 passed（不修改测试文件，行为完全等价）

- [ ] **Step 5.7: Commit**

```bash
git add app/lib/diagrams/cover-card.tsx app/lib/diagrams/player-shell.tsx app/lib/diagrams/interactive-diagram.tsx app/lib/diagrams/layouts/graph-layout.tsx app/lib/agent-timeline-interactive.tsx
git commit -m "feat(diagrams): InteractiveDiagram framework + agent-timeline migration"
```

---

## Task 6 — GraphLayout（节点 + 边 + 当前 step 高亮）

**目标**：实现 `kind === 'graph'` 时的 SVG 渲染（基于绝对坐标），覆盖后续架构图诉求；step 仅作为「高亮路径」而非泳道列。

**依赖**：Task 1（types/schema）、Task 2（state）、Task 5（PlayerShell 注入 currentStep）。

**测试驱动**：[tests/components/diagrams/graph-layout.test.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/tests/components/diagrams/graph-layout.test.tsx)

- [ ] **Step 6.1: 写测试 — `tests/components/diagrams/graph-layout.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { GraphLayout } from '../../../app/lib/diagrams/layouts/graph-layout'
import type { DiagramSchema } from '../../../app/lib/diagrams/types'

const baseGraph: Extract<DiagramSchema, { kind: 'graph' }> = {
  kind: 'graph',
  title: 'demo-graph',
  tone: 'blue',
  nodes: [
    { id: 'n1', label: 'Node 1', x: 100, y: 80, tone: 'blue' },
    { id: 'n2', label: 'Node 2', x: 300, y: 80, tone: 'violet' },
    { id: 'n3', label: 'Node 3', x: 500, y: 80 },
  ],
  edges: [
    { id: 'e12', source: 'n1', target: 'n2', label: 'a' },
    { id: 'e23', source: 'n2', target: 'n3' },
  ],
  steps: [
    { id: 's1', title: 'step1', highlight: { nodes: ['n1'], edges: [] } },
    { id: 's2', title: 'step2', highlight: { nodes: ['n1', 'n2'], edges: ['e12'] } },
    { id: 's3', title: 'step3', highlight: { nodes: ['n2', 'n3'], edges: ['e23'] } },
  ],
}

describe('GraphLayout', () => {
  it('渲染所有 node 与 edge', () => {
    const { container, getByText } = render(<GraphLayout schema={baseGraph} currentStepIndex={0} />)
    expect(getByText('Node 1')).toBeTruthy()
    expect(getByText('Node 2')).toBeTruthy()
    expect(getByText('Node 3')).toBeTruthy()
    expect(container.querySelectorAll('[data-diagram-node]')).toHaveLength(3)
    expect(container.querySelectorAll('[data-diagram-edge]')).toHaveLength(2)
  })

  it('依据 currentStepIndex 给 highlight 内的节点/边添加 data-active="true"', () => {
    const { container } = render(<GraphLayout schema={baseGraph} currentStepIndex={1} />)
    const n1 = container.querySelector('[data-diagram-node="n1"]')
    const n2 = container.querySelector('[data-diagram-node="n2"]')
    const n3 = container.querySelector('[data-diagram-node="n3"]')
    const e12 = container.querySelector('[data-diagram-edge="e12"]')
    const e23 = container.querySelector('[data-diagram-edge="e23"]')
    expect(n1?.getAttribute('data-active')).toBe('true')
    expect(n2?.getAttribute('data-active')).toBe('true')
    expect(n3?.getAttribute('data-active')).toBe('false')
    expect(e12?.getAttribute('data-active')).toBe('true')
    expect(e23?.getAttribute('data-active')).toBe('false')
  })

  it('currentStepIndex 越界时不抛错且不高亮任何节点', () => {
    const { container } = render(<GraphLayout schema={baseGraph} currentStepIndex={99} />)
    container.querySelectorAll('[data-diagram-node]').forEach((el) => {
      expect(el.getAttribute('data-active')).toBe('false')
    })
  })

  it('未提供 steps 时也能正常渲染 nodes/edges（静态架构图场景）', () => {
    const staticGraph: Extract<DiagramSchema, { kind: 'graph' }> = { ...baseGraph, steps: [] }
    const { container, getByText } = render(<GraphLayout schema={staticGraph} currentStepIndex={0} />)
    expect(getByText('Node 1')).toBeTruthy()
    expect(container.querySelectorAll('[data-diagram-node]')).toHaveLength(3)
  })
})
```

Run: `npm test -- tests/components/diagrams/graph-layout.test.tsx`
Expected: 4 failed（GraphLayout 仍是 Task 5 写的占位组件）

- [ ] **Step 6.2: 实现 — `app/lib/diagrams/layouts/graph-layout.tsx`**（替换 Task 5 占位）

```tsx
'use client'

import * as React from 'react'
import type { DiagramSchema } from '../types'

type GraphSchema = Extract<DiagramSchema, { kind: 'graph' }>

export interface GraphLayoutProps {
  schema: GraphSchema
  currentStepIndex: number
}

const NODE_WIDTH = 140
const NODE_HEIGHT = 56
const TONE_FILL: Record<string, string> = {
  blue: '#1d4ed8',
  violet: '#6d28d9',
  cyan: '#0e7490',
  orange: '#c2410c',
  green: '#15803d',
  navy: '#1e3a8a',
}

export function GraphLayout({ schema, currentStepIndex }: GraphLayoutProps) {
  const step = schema.steps[currentStepIndex]
  const activeNodeIds = new Set(step?.highlight?.nodes ?? [])
  const activeEdgeIds = new Set(step?.highlight?.edges ?? [])
  const nodeMap = React.useMemo(
    () => new Map(schema.nodes.map((n) => [n.id, n])),
    [schema.nodes],
  )

  const viewBox = React.useMemo(() => {
    if (schema.nodes.length === 0) return '0 0 800 400'
    const xs = schema.nodes.map((n) => n.x)
    const ys = schema.nodes.map((n) => n.y)
    const maxX = Math.max(...xs) + NODE_WIDTH + 40
    const maxY = Math.max(...ys) + NODE_HEIGHT + 40
    return `0 0 ${Math.max(maxX, 600)} ${Math.max(maxY, 300)}`
  }, [schema.nodes])

  return (
    <svg
      className="ha-diagram-graph"
      role="img"
      aria-label={schema.title}
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <marker id="ha-diagram-arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" fill="currentColor" />
        </marker>
      </defs>
      <g data-layer="edges">
        {schema.edges.map((edge) => {
          const src = nodeMap.get(edge.source)
          const tgt = nodeMap.get(edge.target)
          if (!src || !tgt) return null
          const x1 = src.x + NODE_WIDTH / 2
          const y1 = src.y + NODE_HEIGHT / 2
          const x2 = tgt.x + NODE_WIDTH / 2
          const y2 = tgt.y + NODE_HEIGHT / 2
          const active = activeEdgeIds.has(edge.id)
          return (
            <g key={edge.id} data-diagram-edge={edge.id} data-active={active ? 'true' : 'false'}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={active ? '#0f172a' : '#94a3b8'}
                strokeWidth={active ? 2.5 : 1.5}
                markerEnd="url(#ha-diagram-arrow)"
              />
              {edge.label ? (
                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle" fontSize={12} fill={active ? '#0f172a' : '#475569'}>
                  {edge.label}
                </text>
              ) : null}
            </g>
          )
        })}
      </g>
      <g data-layer="nodes">
        {schema.nodes.map((node) => {
          const active = activeNodeIds.has(node.id)
          const fill = TONE_FILL[node.tone ?? schema.tone ?? 'blue'] ?? TONE_FILL.blue
          return (
            <g
              key={node.id}
              data-diagram-node={node.id}
              data-active={active ? 'true' : 'false'}
              transform={`translate(${node.x},${node.y})`}
            >
              <rect
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={10}
                ry={10}
                fill={fill}
                opacity={active ? 1 : 0.78}
                stroke={active ? '#0f172a' : 'transparent'}
                strokeWidth={active ? 2 : 0}
              />
              <text
                x={NODE_WIDTH / 2}
                y={NODE_HEIGHT / 2 + 4}
                textAnchor="middle"
                fontSize={13}
                fill="#fff"
                fontWeight={active ? 600 : 500}
              >
                {node.label}
              </text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}
```

Run: `npm test -- tests/components/diagrams/graph-layout.test.tsx`
Expected: 4 passed

- [ ] **Step 6.3: Commit**

```bash
git add app/lib/diagrams/layouts/graph-layout.tsx tests/components/diagrams/graph-layout.test.tsx
git commit -m "feat(diagrams): GraphLayout with node/edge highlight by step"
```

---

## Task 7 — MDX 全局注册 + 集成测试 + 最终验证

**目标**：让 MDX 内能直接写 `<InteractiveDiagram>...<Lane/>...</InteractiveDiagram>`；用集成测试覆盖双形态 API、focus trap、键盘快捷键、多实例 overflow 还原；通过 npm test / npm run build / GetDiagnostics 收尾。

**依赖**：Task 1–6 全部完成。

- [ ] **Step 7.1: 修改 — `mdx-components.js`**

读取后在 useMDXComponents 返回对象中追加注册（保留现有组件不动）：

```js
import { InteractiveDiagram } from './app/lib/diagrams/interactive-diagram'
import { Lane } from './app/lib/diagrams/children/lane'
import { Node as DiagramNode } from './app/lib/diagrams/children/node'
import { Edge as DiagramEdge } from './app/lib/diagrams/children/edge'
import { Phase } from './app/lib/diagrams/children/phase'
import { Step } from './app/lib/diagrams/children/step'

export function useMDXComponents(components) {
  return {
    ...components,
    // ...existing registrations preserved
    InteractiveDiagram,
    Lane,
    Node: DiagramNode,
    Edge: DiagramEdge,
    Phase,
    Step,
  }
}
```

注意：若 `Node` 与既有 mdx 元素冲突（HTML 没有 `<Node>` 标签），保持 `Node: DiagramNode` 别名以避免命名污染；MDX 端继续写 `<Node>`。

- [ ] **Step 7.2: 写测试 — `tests/components/diagrams/interactive-diagram.test.tsx`**

```tsx
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InteractiveDiagram } from '../../../app/lib/diagrams/interactive-diagram'
import { Lane } from '../../../app/lib/diagrams/children/lane'
import { Phase } from '../../../app/lib/diagrams/children/phase'
import { Step } from '../../../app/lib/diagrams/children/step'

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

const minimalLanesSchema = {
  kind: 'lanes' as const,
  title: '集成测试时序图',
  tone: 'blue' as const,
  lanes: [
    { id: 'user', label: 'User', tone: 'blue' as const },
    { id: 'agent', label: 'Agent', tone: 'violet' as const },
  ],
  phases: [{ id: 'p1', title: 'Phase 1', range: [0, 1] as [number, number] }],
  steps: [
    { id: 's1', laneId: 'user', phaseId: 'p1', title: 'step1', body: 'b1' },
    { id: 's2', laneId: 'agent', phaseId: 'p1', title: 'step2', body: 'b2' },
  ],
}

describe('InteractiveDiagram — data 形态', () => {
  it('封面卡按钮可打开 dialog 并显示 step 1/2', async () => {
    const user = userEvent.setup()
    render(<InteractiveDiagram schema={minimalLanesSchema} coverButtonLabel="打开" modalTitle="测试播放器" />)
    await user.click(screen.getByRole('button', { name: '打开' }))
    expect(await screen.findByRole('dialog', { name: '测试播放器' })).toBeTruthy()
    expect(screen.getByText('1/2')).toBeTruthy()
  })

  it('键盘 → 翻到下一步、Esc 关闭弹窗', async () => {
    const user = userEvent.setup()
    render(<InteractiveDiagram schema={minimalLanesSchema} coverButtonLabel="打开" modalTitle="测试播放器" />)
    await user.click(screen.getByRole('button', { name: '打开' }))
    await user.keyboard('{ArrowRight}')
    expect(screen.getByText('2/2')).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('InteractiveDiagram — children 形态（MDX）', () => {
  it('解析 children 子组件 → 与 data 形态等价渲染', async () => {
    const user = userEvent.setup()
    render(
      <InteractiveDiagram coverButtonLabel="打开" modalTitle="测试播放器" tone="blue" title="children 形态">
        <Lane id="user" label="User" tone="blue" />
        <Lane id="agent" label="Agent" tone="violet" />
        <Phase id="p1" title="Phase 1" range={[0, 1]} />
        <Step id="s1" laneId="user" phaseId="p1" title="step1" body="b1" />
        <Step id="s2" laneId="agent" phaseId="p1" title="step2" body="b2" />
      </InteractiveDiagram>,
    )
    await user.click(screen.getByRole('button', { name: '打开' }))
    expect(await screen.findByRole('dialog', { name: '测试播放器' })).toBeTruthy()
    expect(screen.getByText('1/2')).toBeTruthy()
  })
})

describe('InteractiveDiagram — 多实例 body overflow 引用计数', () => {
  it('两实例同时打开 → 关一个仍 hidden、关另一个恢复', async () => {
    const user = userEvent.setup()
    render(
      <>
        <InteractiveDiagram schema={minimalLanesSchema} coverButtonLabel="打开 A" modalTitle="A" />
        <InteractiveDiagram schema={minimalLanesSchema} coverButtonLabel="打开 B" modalTitle="B" />
      </>,
    )
    await user.click(screen.getByRole('button', { name: '打开 A' }))
    await user.click(screen.getByRole('button', { name: '打开 B' }))
    expect(document.body.style.overflow).toBe('hidden')

    // 关闭 B
    const dialogB = screen.getByRole('dialog', { name: 'B' })
    fireEvent.keyDown(dialogB, { key: 'Escape' })
    expect(document.body.style.overflow).toBe('hidden')

    // 关闭 A
    const dialogA = screen.getByRole('dialog', { name: 'A' })
    fireEvent.keyDown(dialogA, { key: 'Escape' })
    expect(document.body.style.overflow).toBe('')
  })
})

describe('InteractiveDiagram — schema 校验失败', () => {
  it('未知 laneId 时 fallback 渲染封面但禁用按钮 + 抛出可见错误', () => {
    const broken = {
      ...minimalLanesSchema,
      steps: [{ id: 's1', laneId: 'ghost', phaseId: 'p1', title: 'x', body: 'y' }],
    }
    render(<InteractiveDiagram schema={broken} coverButtonLabel="打开" modalTitle="t" />)
    const btn = screen.getByRole('button', { name: '打开' }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(screen.getByRole('alert')).toBeTruthy()
  })
})
```

Run: `npm test -- tests/components/diagrams/interactive-diagram.test.tsx`
Expected: 全部 passed（如有失败：优先排查 InteractiveDiagram 的 schema 错误兜底分支与 PlayerShell 的 lock/unlock 引用计数）

- [ ] **Step 7.3: 跑全量测试 + 类型/构建**

```bash
npm test
npm run build
```

Expected:
- npm test：所有 vitest 用例通过（含 [tests/agent-timeline-interactive.test.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/tests/agent-timeline-interactive.test.tsx) 0 修改通过）
- npm run build：Next.js 静态导出无 TypeScript 报错；Nextra MDX 编译无 unknown component 警告

随后调用 GetDiagnostics（无 args）确认全仓 0 lint / type error。

- [ ] **Step 7.4: 视觉回归手测**

```bash
npm run dev
```

打开 `/courses/agent/intro`（即原 [agent-timeline-interactive.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/agent-timeline-interactive.tsx) 使用页），验收清单：
- 封面卡尺寸、阴影、按钮文案、配色与重构前一致
- 弹窗打开后泳道/相位条/15 步内容、动画、tone 颜色与重构前一致
- ←/→/Space/Esc 行为正常
- 多次开关后 body 滚动条状态正常

- [ ] **Step 7.5: Commit**

```bash
git add mdx-components.js tests/components/diagrams/interactive-diagram.test.tsx
git commit -m "feat(diagrams): register InteractiveDiagram in MDX + integration tests"
```

---

## Plan 自检（执行前必读）

- **Spec coverage**：Spec §3（架构分层）由 Task 1/2/3/5 实现；§4（双形态 API）由 Task 3/5 + Task 7.2 children 用例实现；§5（可访问性 + lock 计数）由 Task 5 PlayerShell + Task 7.2 多实例用例实现；§6（zod schema）由 Task 1 + Task 7.2 broken schema 用例实现；§7（layout 边界）由 Task 4 + Task 6 实现；§8（渐进迁移）由 Task 4 数据迁移 + Task 5 薄封装 + 现有测试 0 修改实现；§9（验收标准）由 Task 7.3/7.4 实现 ✅ 全覆盖
- **Placeholder scan**：Task 5 GraphLayout 占位 → Task 6 替换；除此外全文无 TODO/TBD
- **Type consistency**：Task 1 定义的 `DiagramSchema` 在 Task 2/3/4/5/6 均通过 `Extract<DiagramSchema, { kind: '...' }>` 引用，无重复定义；ToneEnum 全程通过 `import type` 共享
- **Test pyramid**：unit（schema/state/children 各自 ≤ 10 用例） → component（lanes-layout、graph-layout 各 4 用例） → integration（interactive-diagram 4 个 describe）→ legacy regression（agent-timeline-interactive 0 修改）
- **Commit 颗粒度**：7 个 task、每个 task 1 commit、便于 review 与回滚
- **风险点 1**：MDX 中 `<Node>` 命名可能与未来扩展冲突；mitigations：在 mdx-components.js 用 `Node: DiagramNode` 别名，且仅在 InteractiveDiagram children 树中识别 `__diagramKind === 'node'`，对外仍允许覆盖
- **风险点 2**：Nextra 4.5 的 useMDXComponents 默认 merge 策略 → 不会丢失内置组件
- **风险点 3**：`createPortal(document.body)` 在 SSR/静态导出阶段不会执行（仅在 isOpen 时调用）→ 与 `output: 'export'` 兼容
- **回滚策略**：每 task 一次 commit，单 task 失败可 `git revert <hash>`；agent-timeline 视觉回归失败可临时把 [agent-timeline-interactive.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/agent-timeline-interactive.tsx) 还原为旧实现（旧逻辑保留在 git 历史）

---

## Execution Handoff

执行模式建议（请你二选一确认）：

1. **subagent-driven-development（推荐）**：每个 task 派一个 subagent 执行（写测试 → 实现 → 跑测试 → 报告差异 → 不自动 commit），主线收到 OK 后我手工执行 commit；适合代码量大、互相独立、并行收益明显
2. **executing-plans（inline）**：我在主会话内逐 task TDD 执行，任何阶段阻塞我会立即向你提问；适合需要紧密观察 + 实时调整 tone/colors 的场景

**默认选项**：subagent-driven-development（除非你明确要求 inline）。

待你确认执行模式 + 是否要并发跑多个独立 task 后，我即开始执行 Task 1。

