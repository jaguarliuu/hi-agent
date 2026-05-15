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
