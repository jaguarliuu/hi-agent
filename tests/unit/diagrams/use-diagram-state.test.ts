import { describe, expect, it } from 'vitest'
import { diagramReducer, initialState } from '../../../app/lib/diagrams/use-diagram-state'

describe('diagramReducer', () => {
  const ctx = { stepCount: 5 }

  it('OPEN sets isOpen=true and resets index', () => {
    const next = diagramReducer({ ...initialState, currentIndex: 3 }, { type: 'OPEN' }, ctx)
    expect(next.isOpen).toBe(true)
    expect(next.currentIndex).toBe(0)
    expect(next.isPlaying).toBe(false)
  })

  it('CLOSE sets isOpen=false and pauses', () => {
    const next = diagramReducer({ isOpen: true, currentIndex: 2, isPlaying: true }, { type: 'CLOSE' }, ctx)
    expect(next.isOpen).toBe(false)
    expect(next.isPlaying).toBe(false)
  })

  it('NEXT advances by 1 within bounds', () => {
    const next = diagramReducer({ isOpen: true, currentIndex: 0, isPlaying: false }, { type: 'NEXT' }, ctx)
    expect(next.currentIndex).toBe(1)
  })

  it('NEXT clamps at last index and stops playing', () => {
    const next = diagramReducer({ isOpen: true, currentIndex: 4, isPlaying: true }, { type: 'NEXT' }, ctx)
    expect(next.currentIndex).toBe(4)
    expect(next.isPlaying).toBe(false)
  })

  it('PREV clamps at 0', () => {
    const next = diagramReducer({ isOpen: true, currentIndex: 0, isPlaying: false }, { type: 'PREV' }, ctx)
    expect(next.currentIndex).toBe(0)
  })

  it('GOTO clamps to bounds and pauses', () => {
    const next = diagramReducer(
      { isOpen: true, currentIndex: 0, isPlaying: true },
      { type: 'GOTO', index: 99 },
      ctx
    )
    expect(next.currentIndex).toBe(4)
    expect(next.isPlaying).toBe(false)
  })

  it('TOGGLE_PLAY flips isPlaying', () => {
    const next = diagramReducer({ isOpen: true, currentIndex: 0, isPlaying: false }, { type: 'TOGGLE_PLAY' }, ctx)
    expect(next.isPlaying).toBe(true)
  })

  it('TOGGLE_PLAY at last index restarts from 0', () => {
    const next = diagramReducer({ isOpen: true, currentIndex: 4, isPlaying: false }, { type: 'TOGGLE_PLAY' }, ctx)
    expect(next.isPlaying).toBe(true)
    expect(next.currentIndex).toBe(0)
  })
})
