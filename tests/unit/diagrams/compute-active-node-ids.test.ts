import { describe, expect, it } from 'vitest'
import { computeActiveNodeIds } from '../../../app/lib/diagrams/layouts/graph-layout'
import type { NodeSchema, StepSchema } from '../../../app/lib/diagrams/types'

const nodes: NodeSchema[] = [
  { id: 'a', title: 'A', x: 0, y: 0, tone: 'blue', phase: 'p1' },
  { id: 'b', title: 'B', x: 0, y: 0, tone: 'blue', phase: 'p1' },
  { id: 'c', title: 'C', x: 0, y: 0, tone: 'green', phase: 'p2' }
]

describe('computeActiveNodeIds', () => {
  it('returns empty set when current is undefined', () => {
    expect(computeActiveNodeIds(undefined, nodes).size).toBe(0)
  })

  it('returns all nodes that share the current step phase', () => {
    const step: StepSchema = { id: 1, phase: 'p1', tone: 'blue', title: 'T', detail: 'D' }
    const out = computeActiveNodeIds(step, nodes)
    expect(out).toEqual(new Set(['a', 'b']))
  })

  it('falls back to from/to when phase has no matching nodes', () => {
    const step: StepSchema = { id: 1, phase: 'pX', from: 'a', to: 'c', tone: 'blue', title: 'T', detail: 'D' }
    const out = computeActiveNodeIds(step, nodes)
    expect(out).toEqual(new Set(['a', 'c']))
  })

  it('uses from/to when no phase is provided', () => {
    const step: StepSchema = { id: 1, from: 'a', to: 'c', tone: 'blue', title: 'T', detail: 'D' }
    const out = computeActiveNodeIds(step, nodes)
    expect(out).toEqual(new Set(['a', 'c']))
  })

  it('returns empty set when neither phase matches nor from/to provided', () => {
    const step: StepSchema = { id: 1, phase: 'pX', tone: 'blue', title: 'T', detail: 'D' }
    expect(computeActiveNodeIds(step, nodes).size).toBe(0)
  })
})
