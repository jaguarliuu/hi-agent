import type { Tone } from '../types'

export type StepProps = {
  id: number | string
  from?: string
  to?: string
  y?: number
  phase?: string
  tone: Tone
  title: string
  subtitle?: string
  detail: string
  engineering?: string
}

export function Step(_props: StepProps): null {
  return null
}
Step.__diagramKind = 'step' as const
