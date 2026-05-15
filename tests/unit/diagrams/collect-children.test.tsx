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
