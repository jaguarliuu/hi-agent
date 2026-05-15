'use client'

import React from 'react'
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
