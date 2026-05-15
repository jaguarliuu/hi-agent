import React from 'react'
import type { DiagramSchema } from '../types'

export type GraphLayoutProps = { schema: DiagramSchema; currentIndex: number }

export function GraphLayout(_props: GraphLayoutProps) {
  return <div className="ha-agent-timeline__stage" aria-hidden="true" />
}
