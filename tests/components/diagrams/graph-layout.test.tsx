import React from 'react'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { GraphLayout } from '@/app/lib/diagrams/layouts/graph-layout'
import type { DiagramSchema } from '@/app/lib/diagrams/types'

function buildSchema(): DiagramSchema {
  return {
    nodes: [
      { id: 'a', title: 'Node A', x: 40, y: 60, tone: 'blue' },
      { id: 'b', title: 'Node B', x: 220, y: 60, tone: 'violet' },
      { id: 'c', title: 'Node C', x: 400, y: 60, tone: 'green' }
    ],
    edges: [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' }
    ],
    steps: [
      { id: 1, from: 'a', to: 'b', tone: 'blue', title: 'A→B', detail: 'first' },
      { id: 2, from: 'b', to: 'c', tone: 'violet', title: 'B→C', detail: 'second' },
      { id: 3, from: 'a', to: 'c', tone: 'green', title: 'A→C', detail: 'third' }
    ]
  }
}

describe('GraphLayout', () => {
  it('renders all nodes and edges from schema', () => {
    const { container } = render(
      <GraphLayout schema={buildSchema()} currentIndex={0} />
    )
    const nodes = container.querySelectorAll('[data-diagram-node]')
    const edges = container.querySelectorAll('[data-diagram-edge]')
    expect(nodes).toHaveLength(3)
    expect(edges).toHaveLength(2)
    expect(container.querySelector('[data-diagram-node="a"]')).not.toBeNull()
    expect(container.querySelector('[data-diagram-node="b"]')).not.toBeNull()
    expect(container.querySelector('[data-diagram-node="c"]')).not.toBeNull()
    expect(container.querySelector('[data-diagram-edge="a-b"]')).not.toBeNull()
    expect(container.querySelector('[data-diagram-edge="b-c"]')).not.toBeNull()
  })

  it('marks active nodes and edge for current step', () => {
    const { container } = render(
      <GraphLayout schema={buildSchema()} currentIndex={1} />
    )
    expect(
      container.querySelector('[data-diagram-node="b"]')?.getAttribute('data-active')
    ).toBe('true')
    expect(
      container.querySelector('[data-diagram-node="c"]')?.getAttribute('data-active')
    ).toBe('true')
    expect(
      container.querySelector('[data-diagram-node="a"]')?.getAttribute('data-active')
    ).toBe('false')
    expect(
      container.querySelector('[data-diagram-edge="b-c"]')?.getAttribute('data-active')
    ).toBe('true')
    expect(
      container.querySelector('[data-diagram-edge="a-b"]')?.getAttribute('data-active')
    ).toBe('false')
  })

  it('does not throw and marks nothing active when currentIndex is out of bounds', () => {
    const { container } = render(
      <GraphLayout schema={buildSchema()} currentIndex={42} />
    )
    const activeNodes = container.querySelectorAll(
      '[data-diagram-node][data-active="true"]'
    )
    const activeEdges = container.querySelectorAll(
      '[data-diagram-edge][data-active="true"]'
    )
    expect(activeNodes).toHaveLength(0)
    expect(activeEdges).toHaveLength(0)
  })

  it('renders statically when steps array is empty', () => {
    const schema: DiagramSchema = { ...buildSchema(), steps: [] }
    const { container } = render(
      <GraphLayout schema={schema} currentIndex={0} />
    )
    expect(container.querySelectorAll('[data-diagram-node]')).toHaveLength(3)
    expect(container.querySelectorAll('[data-diagram-edge]')).toHaveLength(2)
    const activeNodes = container.querySelectorAll(
      '[data-diagram-node][data-active="true"]'
    )
    expect(activeNodes).toHaveLength(0)
  })
})
