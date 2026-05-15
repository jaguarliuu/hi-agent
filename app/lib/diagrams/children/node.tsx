import type { Tone } from '../types'

export type NodeProps = {
  id: string
  title: string
  subtitle?: string
  x: number
  y: number
  tone: Tone
}

export function Node(_props: NodeProps): null {
  return null
}
Node.__diagramKind = 'node' as const
