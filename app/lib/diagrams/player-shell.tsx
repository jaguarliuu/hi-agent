'use client'

import React, { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { DiagramSchema, DiagramLayoutKind } from './types'
import type { DiagramAction, DiagramState } from './use-diagram-state'
import { LanesLayout } from './layouts/lanes-layout'
import { GraphLayout } from './layouts/graph-layout'

const LOCK_COUNT_KEY = 'diagramLockCount'
const PREV_OVERFLOW_KEY = 'diagramPrevOverflow'

function lockBodyScroll() {
  if (typeof document === 'undefined') return
  const body = document.body
  const next = Number(body.dataset[LOCK_COUNT_KEY] ?? '0') + 1
  if (next === 1) {
    body.dataset[PREV_OVERFLOW_KEY] = body.style.overflow
    body.style.overflow = 'hidden'
  }
  body.dataset[LOCK_COUNT_KEY] = String(next)
}
function unlockBodyScroll() {
  if (typeof document === 'undefined') return
  const body = document.body
  const cur = Number(body.dataset[LOCK_COUNT_KEY] ?? '0')
  const next = Math.max(0, cur - 1)
  if (next === 0) {
    body.style.overflow = body.dataset[PREV_OVERFLOW_KEY] ?? ''
    delete body.dataset[PREV_OVERFLOW_KEY]
    delete body.dataset[LOCK_COUNT_KEY]
    return
  }
  body.dataset[LOCK_COUNT_KEY] = String(next)
}

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => !el.hasAttribute('inert'))
}

export type PlayerShellProps = {
  id: string
  layout: DiagramLayoutKind
  schema: DiagramSchema
  modalTitle: string
  autoPlayInterval: number
  state: DiagramState
  dispatch: (action: DiagramAction) => void
  onReturnFocus: () => void
}

export function PlayerShell({
  id,
  layout,
  schema,
  modalTitle,
  autoPlayInterval,
  state,
  dispatch,
  onReturnFocus
}: PlayerShellProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const phases = schema.phases ?? []
  const steps = schema.steps
  const current = steps[state.currentIndex]
  const activePhase = current?.phase

  const phaseLookup = useMemo(() => {
    // Maps phase.id → first step index that belongs to this phase.
    // Click on a phase tab always jumps to the FIRST step of that phase,
    // not "next step in current phase". This is intentional: phase tab is
    // a section anchor, not a forward-step button.
    const map: Record<string, number> = {}
    phases.forEach((p) => {
      const idx = steps.findIndex((s) => s.phase === p.id)
      if (idx >= 0) map[p.id] = idx
    })
    return map
  }, [phases, steps])

  useEffect(() => {
    if (!state.isOpen) return
    lockBodyScroll()
    closeBtnRef.current?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        dispatch({ type: 'CLOSE' })
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        dispatch({ type: 'NEXT' })
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        dispatch({ type: 'PREV' })
        return
      }
      if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault()
        dispatch({ type: 'TOGGLE_PLAY' })
        return
      }
      if (event.key === 'Tab' && panelRef.current) {
        const focusables = getFocusable(panelRef.current)
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement as HTMLElement | null
        if (active && !panelRef.current.contains(active)) {
          event.preventDefault()
          first.focus()
          return
        }
        if (event.shiftKey && active === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && active === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      unlockBodyScroll()
      onReturnFocus()
    }
  }, [state.isOpen, id, dispatch, onReturnFocus])

  useEffect(() => {
    if (!state.isPlaying) return
    const timer = window.setInterval(() => dispatch({ type: 'NEXT' }), autoPlayInterval)
    return () => window.clearInterval(timer)
  }, [state.isPlaying, autoPlayInterval, dispatch])

  if (!state.isOpen || typeof document === 'undefined') return null

  const titleId = `${id}-modal-title`

  const canvas =
    layout === 'graph' ? (
      <GraphLayout schema={schema} currentIndex={state.currentIndex} />
    ) : (
      <LanesLayout schema={schema} currentIndex={state.currentIndex} />
    )

  return createPortal(
    <div
      className="ha-agent-timeline-modal"
      role="dialog"
      aria-modal="true"
      aria-label={modalTitle}
      aria-labelledby={titleId}
      onClick={() => dispatch({ type: 'CLOSE' })}
    >
      <div
        ref={panelRef}
        className="ha-agent-timeline-modal__panel"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          ref={closeBtnRef}
          type="button"
          aria-label="关闭交互时序"
          className="ha-agent-timeline-modal__close"
          onClick={() => dispatch({ type: 'CLOSE' })}
        >
          <span aria-hidden>×</span>
        </button>
        <section className="ha-agent-timeline" aria-label={modalTitle}>
          <div className="ha-agent-timeline__header">
            <div>
              <p className="ha-agent-timeline__eyebrow">OpenClaw Agent Sequence</p>
              <h3 id={titleId}>{modalTitle}</h3>
            </div>
            <div className="ha-agent-timeline__controls" aria-label="时序控制">
              <button type="button" aria-label="上一步" onClick={() => dispatch({ type: 'PREV' })}>
                <span aria-hidden>‹</span>
              </button>
              <button
                type="button"
                aria-label={state.isPlaying ? '暂停' : '播放'}
                className="is-primary"
                onClick={() => dispatch({ type: 'TOGGLE_PLAY' })}
              >
                <span aria-hidden>{state.isPlaying ? 'Ⅱ' : '▶'}</span>
              </button>
              <button type="button" aria-label="下一步" onClick={() => dispatch({ type: 'NEXT' })}>
                <span aria-hidden>›</span>
              </button>
            </div>
          </div>
          <div className="ha-agent-timeline__body">
            {canvas}
            <aside
              className="ha-agent-timeline__inspector"
              data-tone={current?.tone}
              aria-live="polite"
            >
              <div className="ha-agent-timeline__counter">
                {state.currentIndex + 1} / {steps.length}
              </div>
              <h4>{current?.title}</h4>
              {current?.subtitle ? (
                <p className="ha-agent-timeline__subtitle">{current.subtitle}</p>
              ) : null}
              <p>{current?.detail}</p>
              {current?.engineering ? (
                <div className="ha-agent-timeline__note">
                  <span>工程含义</span>
                  <p>{current.engineering}</p>
                </div>
              ) : null}
            </aside>
          </div>
          {phases.length > 0 ? (
            <nav className="ha-agent-timeline__phases" aria-label="核心流程阶段">
              {phases.map((phase) => (
                <button
                  key={phase.id}
                  type="button"
                  aria-label={phase.label}
                  data-active={phase.id === activePhase}
                  onClick={() => dispatch({ type: 'GOTO', index: phaseLookup[phase.id] ?? 0 })}
                >
                  <span>{phase.label}</span>
                  <small>{phase.summary}</small>
                </button>
              ))}
            </nav>
          ) : null}
        </section>
      </div>
    </div>,
    document.body
  )
}
