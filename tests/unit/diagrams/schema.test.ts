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
})

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

  it('rejects phase-only step when phases array is not declared at all', () => {
    expect(() =>
      parseDiagramSchema({
        nodes: [{ id: 'n1', title: 'N1', x: 0, y: 0, tone: 'blue' }],
        steps: [{ id: 1, phase: 'p1', tone: 'blue', title: 'T', detail: 'D' }]
      })
    ).toThrow(/no phases are declared/)
  })

  it('rejects from/to step when neither lanes nor nodes are declared', () => {
    expect(() =>
      parseDiagramSchema({
        phases: [{ id: 'p1', label: 'P1', summary: '' }],
        steps: [{ id: 1, from: 'a', to: 'b', tone: 'blue', title: 'T', detail: 'D' }]
      })
    ).toThrow(/neither lanes nor nodes are declared/)
  })
})
