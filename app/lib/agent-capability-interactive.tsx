'use client'

import React from 'react'
import { InteractiveDiagram } from './diagrams/interactive-diagram'
import { agentCapabilitySchema } from './diagrams/data/agent-capability'

export function AgentCapabilityInteractive() {
  return (
    <InteractiveDiagram
      id="agent-capability"
      layout="graph"
      coverEyebrow="Agent System Panorama"
      coverTitle="Agent 系统能力全景图"
      coverDescription="以目标为驱动，围绕对话、上下文、行动、工具、记忆、协作与运行时保障，构建可落地的智能体系统。"
      coverButtonLabel="打开能力全景"
      modalTitle="Agent 能力全景播放器"
      data={agentCapabilitySchema}
      autoPlayInterval={1600}
    />
  )
}
