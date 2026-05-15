import type { ReactNode } from 'react'

export type PhaseProps = {
  id: string
  label: string
  summary: string
  children?: ReactNode
}

export function Phase(_props: PhaseProps): null {
  return null
}
Phase.__diagramKind = 'phase' as const
