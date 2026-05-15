export type Tone = 'blue' | 'violet' | 'cyan' | 'orange' | 'green' | 'navy'

export type LaneSchema = {
  id: string
  title: string
  subtitle?: string
  tone: Tone
}

export type NodeSchema = {
  id: string
  title: string
  subtitle?: string
  x: number
  y: number
  tone: Tone
  phase?: string
}

export type EdgeSchema = {
  source: string
  target: string
}

export type PhaseSchema = {
  id: string
  label: string
  summary: string
}

export type StepSchema = {
  id: number | string
  from: string
  to: string
  y?: number
  phase?: string
  tone: Tone
  title: string
  subtitle?: string
  detail: string
  engineering?: string
}

export type DiagramSchema = {
  lanes?: LaneSchema[]
  nodes?: NodeSchema[]
  edges?: EdgeSchema[]
  phases?: PhaseSchema[]
  steps: StepSchema[]
}

export type DiagramLayoutKind = 'lanes' | 'graph' | 'flow'
