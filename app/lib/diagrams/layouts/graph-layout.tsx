import React from 'react'
import type { DiagramSchema, EdgeSchema, NodeSchema, Tone } from '../types'

export type GraphLayoutProps = { schema: DiagramSchema; currentIndex: number }

const NODE_WIDTH = 140
const NODE_HEIGHT = 56

const toneColors: Record<Tone, string> = {
  blue: '#1d4ed8',
  violet: '#6d28d9',
  cyan: '#0e7490',
  orange: '#c2410c',
  green: '#15803d',
  navy: '#1e3a8a'
}

function nodeCenter(node: NodeSchema) {
  return { cx: node.x + NODE_WIDTH / 2, cy: node.y + NODE_HEIGHT / 2 }
}

function edgeKey(edge: EdgeSchema) {
  return `${edge.source}-${edge.target}`
}

export function GraphLayout({ schema, currentIndex }: GraphLayoutProps) {
  const nodes = schema.nodes ?? []
  const edges = schema.edges ?? []
  const steps = schema.steps ?? []
  const current = steps[currentIndex]
  const activeNodeIds = new Set<string>()
  if (current) {
    activeNodeIds.add(current.from)
    activeNodeIds.add(current.to)
  }
  const nodeById = new Map(nodes.map((node) => [node.id, node]))

  return (
    <svg
      className="ha-diagram-graph"
      viewBox="0 0 1064 620"
      role="img"
      aria-hidden="true"
    >
      <defs>
        <marker
          id="ha-diagram-arrow"
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
      {edges.map((edge) => {
        const source = nodeById.get(edge.source)
        const target = nodeById.get(edge.target)
        if (!source || !target) return null
        const { cx: x1, cy: y1 } = nodeCenter(source)
        const { cx: x2, cy: y2 } = nodeCenter(target)
        const isActive =
          !!current && current.from === edge.source && current.to === edge.target
        return (
          <line
            key={edgeKey(edge)}
            data-diagram-edge={edgeKey(edge)}
            data-active={isActive ? 'true' : 'false'}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            markerEnd="url(#ha-diagram-arrow)"
          />
        )
      })}
      {nodes.map((node) => {
        const isActive = activeNodeIds.has(node.id)
        const color = toneColors[node.tone]
        return (
          <g
            key={node.id}
            data-diagram-node={node.id}
            data-active={isActive ? 'true' : 'false'}
            data-tone={node.tone}
            transform={`translate(${node.x},${node.y})`}
            style={{ color }}
          >
            <rect
              width={NODE_WIDTH}
              height={NODE_HEIGHT}
              rx={10}
              ry={10}
              fill="white"
              stroke={color}
              strokeWidth={isActive ? 3 : 1.5}
            />
            <text
              x={NODE_WIDTH / 2}
              y={node.subtitle ? NODE_HEIGHT / 2 - 2 : NODE_HEIGHT / 2 + 4}
              textAnchor="middle"
              fill={color}
            >
              {node.title}
            </text>
            {node.subtitle ? (
              <text
                x={NODE_WIDTH / 2}
                y={NODE_HEIGHT / 2 + 14}
                textAnchor="middle"
                fill={color}
                opacity={0.75}
              >
                {node.subtitle}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}
