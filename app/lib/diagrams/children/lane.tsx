import type { Tone } from '../types'

export type LaneProps = {
  id: string
  title: string
  subtitle?: string
  tone: Tone
}

export function Lane(_props: LaneProps): null {
  return null
}
Lane.__diagramKind = 'lane' as const
