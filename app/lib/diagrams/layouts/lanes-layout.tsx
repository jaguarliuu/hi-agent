import React from 'react'
import type { DiagramSchema, LaneSchema, StepSchema } from '../types'
import { TONE_COLORS } from '../tone'

export type LanesLayoutProps = {
  schema: DiagramSchema
  currentIndex: number
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
            const color = TONE_COLORS[step.tone]
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
