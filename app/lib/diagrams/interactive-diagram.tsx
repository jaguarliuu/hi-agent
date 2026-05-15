'use client'

import React, { useCallback, useMemo, useRef, type ReactNode } from 'react'
import type { DiagramLayoutKind, DiagramSchema, LaneSchema, NodeSchema } from './types'
import { collectDiagramSchema } from './children'
import { parseDiagramSchema } from './schema'
import { useDiagramState } from './use-diagram-state'
import { CoverCard } from './cover-card'
import { PlayerShell } from './player-shell'

export type InteractiveDiagramProps = {
  id: string
  layout: DiagramLayoutKind
  coverEyebrow?: string
  coverTitle: string
  coverDescription?: string
  coverButtonLabel?: string
  previewQuestion?: string
  modalTitle?: string
  autoPlayInterval?: number
  data?: DiagramSchema
  children?: ReactNode
}

type SchemaResult =
  | { schema: DiagramSchema; validationError: null }
  | { schema: null; validationError: string }

export function InteractiveDiagram({
  id,
  layout,
  coverEyebrow,
  coverTitle,
  coverDescription,
  coverButtonLabel = '打开交互时序',
  previewQuestion,
  modalTitle,
  autoPlayInterval = 1400,
  data,
  children
}: InteractiveDiagramProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)

  const { schema, validationError } = useMemo<SchemaResult>(() => {
    const raw = data ?? collectDiagramSchema(children)
    if (!raw || raw.steps.length === 0) {
      return { schema: null, validationError: 'Diagram has no steps' }
    }
    try {
      return { schema: parseDiagramSchema(raw), validationError: null }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        throw err
      }
      const message = err instanceof Error ? err.message : 'Invalid diagram schema'
      console.warn(`[InteractiveDiagram:${id}]`, message)
      return { schema: null, validationError: message }
    }
  }, [data, children, id])

  const stepCount = schema?.steps.length ?? 0
  const [state, dispatch] = useDiagramState(stepCount)

  const handleOpen = useCallback(() => dispatch({ type: 'OPEN' }), [dispatch])
  const returnFocus = useCallback(() => triggerRef.current?.focus(), [])

  if (!schema) {
    return (
      <div role="alert" className="ha-agent-timeline-entry">
        Diagram error: {validationError}
      </div>
    )
  }

  const previewLanes: LaneSchema[] | undefined = layout === 'lanes' ? schema.lanes : undefined
  const previewNodes: NodeSchema[] | undefined = layout === 'graph' ? schema.nodes : undefined

  return (
    <>
      <CoverCard
        ref={triggerRef}
        eyebrow={coverEyebrow}
        title={coverTitle}
        description={coverDescription}
        buttonLabel={coverButtonLabel}
        previewQuestion={previewQuestion}
        previewLanes={previewLanes}
        previewNodes={previewNodes}
        onOpen={handleOpen}
        titleId={`${id}-cover-title`}
      />
      <PlayerShell
        id={id}
        layout={layout}
        schema={schema}
        modalTitle={modalTitle ?? coverTitle}
        autoPlayInterval={autoPlayInterval}
        state={state}
        dispatch={dispatch}
        onReturnFocus={returnFocus}
      />
    </>
  )
}
