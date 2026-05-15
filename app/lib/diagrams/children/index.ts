import { Children, Fragment, isValidElement, type ReactNode } from 'react'
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
      if (!isValidElement(child)) return
      // Unwrap React Fragments so callers can use <>...</> as a grouping wrapper
      if ((child as { type?: unknown }).type === Fragment) {
        const fragmentChildren = (child.props as { children?: ReactNode }).children
        walk(fragmentChildren, currentPhaseId)
        return
      }
      const kind = kindOf(child)
      if (!kind) return
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
