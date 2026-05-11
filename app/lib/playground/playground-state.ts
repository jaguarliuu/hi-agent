export type PlaygroundStatus =
  | 'idle'
  | 'booting'
  | 'loading'
  | 'ready'
  | 'running'
  | 'error'
  | 'unsupported';

export interface PlaygroundState {
  status: PlaygroundStatus;
  sectionId: string | null;
  activeFile: string | null;
  error: string | null;
}

export const initialPlaygroundState: PlaygroundState = {
  status: 'idle',
  sectionId: null,
  activeFile: null,
  error: null
};

export type PlaygroundEvent =
  | { type: 'RESET'; sectionId: string }
  | { type: 'BOOT_STARTED'; sectionId: string }
  | { type: 'WORKSPACE_LOADING'; sectionId: string }
  | { type: 'WORKSPACE_READY'; sectionId: string; activeFile: string }
  | { type: 'COMMAND_DISPATCHED'; sectionId: string }
  | { type: 'COMMAND_FINISHED' }
  | { type: 'FAILED'; message: string }
  | { type: 'UNSUPPORTED' };

export function playgroundReducer(
  state: PlaygroundState,
  event: PlaygroundEvent
): PlaygroundState {
  switch (event.type) {
    case 'RESET':
      return {
        ...initialPlaygroundState,
        sectionId: event.sectionId
      };
    case 'BOOT_STARTED':
      return {
        ...state,
        status: 'booting',
        sectionId: event.sectionId,
        activeFile: null,
        error: null
      };
    case 'WORKSPACE_LOADING':
      return {
        ...state,
        status: 'loading',
        sectionId: event.sectionId,
        activeFile: null,
        error: null
      };
    case 'WORKSPACE_READY':
      return {
        ...state,
        status: 'ready',
        sectionId: event.sectionId,
        activeFile: event.activeFile,
        error: null
      };
    case 'COMMAND_DISPATCHED':
      return {
        ...state,
        status: 'running',
        sectionId: event.sectionId
      };
    case 'COMMAND_FINISHED':
      return {
        ...state,
        status: 'ready'
      };
    case 'FAILED':
      return {
        ...state,
        status: 'error',
        error: event.message
      };
    case 'UNSUPPORTED':
      return {
        ...state,
        status: 'unsupported',
        error: 'WebContainers require a compatible desktop browser.'
      };
    default:
      return state;
  }
}
