import { useReducer } from 'react'

export type DiagramState = {
  isOpen: boolean
  currentIndex: number
  isPlaying: boolean
}

export type DiagramAction =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'NEXT' }
  | { type: 'PREV' }
  | { type: 'GOTO'; index: number }
  | { type: 'TOGGLE_PLAY' }
  | { type: 'PAUSE' }

export type DiagramReducerCtx = { stepCount: number }

export const initialState: DiagramState = {
  isOpen: false,
  currentIndex: 0,
  isPlaying: false
}

function clamp(value: number, max: number) {
  if (max <= 0) return 0
  return Math.max(0, Math.min(max - 1, value))
}

export function diagramReducer(
  state: DiagramState,
  action: DiagramAction,
  ctx: DiagramReducerCtx
): DiagramState {
  const last = Math.max(0, ctx.stepCount - 1)
  switch (action.type) {
    case 'OPEN':
      return { ...state, isOpen: true, currentIndex: 0, isPlaying: false }
    case 'CLOSE':
      return { ...state, isOpen: false, isPlaying: false }
    case 'NEXT': {
      const next = state.currentIndex + 1
      if (next > last) return { ...state, currentIndex: last, isPlaying: false }
      return { ...state, currentIndex: next }
    }
    case 'PREV':
      return { ...state, currentIndex: clamp(state.currentIndex - 1, ctx.stepCount), isPlaying: false }
    case 'GOTO':
      return { ...state, currentIndex: clamp(action.index, ctx.stepCount), isPlaying: false }
    case 'TOGGLE_PLAY':
      if (!state.isPlaying && state.currentIndex >= last) {
        return { ...state, isPlaying: true, currentIndex: 0 }
      }
      return { ...state, isPlaying: !state.isPlaying }
    case 'PAUSE':
      return { ...state, isPlaying: false }
  }
}

export function useDiagramState(stepCount: number) {
  const [state, dispatchRaw] = useReducer(
    (s: DiagramState, a: DiagramAction) => diagramReducer(s, a, { stepCount }),
    initialState
  )
  return [state, dispatchRaw] as const
}
