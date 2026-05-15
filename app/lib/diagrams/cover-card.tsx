import React, { forwardRef } from 'react'
import type { LaneSchema, NodeSchema } from './types'

export type CoverCardProps = {
  eyebrow?: string
  title: string
  description?: string
  buttonLabel: string
  previewQuestion?: string
  previewLanes?: Array<Pick<LaneSchema, 'id' | 'title' | 'tone'>>
  previewNodes?: Array<Pick<NodeSchema, 'id' | 'title' | 'tone'>>
  onOpen: () => void
  titleId: string
}

export const CoverCard = forwardRef<HTMLButtonElement, CoverCardProps>(function CoverCard(
  {
    eyebrow,
    title,
    description,
    buttonLabel,
    previewQuestion,
    previewLanes,
    previewNodes,
    onOpen,
    titleId
  },
  ref
) {
  const items = previewLanes ?? previewNodes ?? []
  return (
    <div className="ha-agent-timeline-entry">
      <section className="ha-agent-timeline-cover" aria-labelledby={titleId}>
        <div className="ha-agent-timeline-cover__content">
          {eyebrow ? <p className="ha-agent-timeline-cover__eyebrow">{eyebrow}</p> : null}
          <h3 id={titleId}>{title}</h3>
          {description ? <p>{description}</p> : null}
          <button ref={ref} type="button" aria-label={buttonLabel} onClick={onOpen}>
            <span>{buttonLabel}</span>
            <span aria-hidden>↗</span>
          </button>
        </div>
        <button
          type="button"
          aria-label={`${buttonLabel}预览`}
          className="ha-agent-timeline-cover__preview"
          onClick={onOpen}
        >
          {previewQuestion ? (
            <span className="ha-agent-timeline-cover__question">{previewQuestion}</span>
          ) : null}
          <span className="ha-agent-timeline-cover__lanes" aria-hidden="true">
            {items.map((item) => (
              <span key={item.id} data-tone={item.tone}>
                <strong>{item.title}</strong>
              </span>
            ))}
          </span>
          <span className="ha-agent-timeline-cover__pulse one" aria-hidden="true" />
          <span className="ha-agent-timeline-cover__pulse two" aria-hidden="true" />
          <span className="ha-agent-timeline-cover__pulse three" aria-hidden="true" />
        </button>
      </section>
    </div>
  )
})
