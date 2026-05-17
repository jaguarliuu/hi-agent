export type PlaygroundStatus =
  | 'idle'
  | 'booting'
  | 'loading'
  | 'ready'
  | 'running'
  | 'error'
  | 'unsupported';

export type PlaygroundBootStage =
  | 'idle'
  | 'prelude'
  | 'loading-kernel'
  | 'mounting-snapshot'
  | 'starting-shell'
  | 'ready';

export interface PlaygroundState {
  status: PlaygroundStatus;
  bootStage: PlaygroundBootStage;
  bootProgress: number;
  sectionId: string | null;
  activeFile: string | null;
  error: string | null;
}

export const initialPlaygroundState: PlaygroundState = {
  status: 'idle',
  bootStage: 'idle',
  bootProgress: 0,
  sectionId: null,
  activeFile: null,
  error: null
};

export type PlaygroundEvent =
  | { type: 'RESET'; sectionId: string }
  | { type: 'BOOT_STARTED'; sectionId: string }
  | {
      type: 'BOOT_STAGE_CHANGED';
      sectionId: string;
      bootStage: Exclude<PlaygroundBootStage, 'idle' | 'ready'>;
      status: Extract<PlaygroundStatus, 'booting' | 'loading'>;
      progress?: number;
    }
  | { type: 'BOOT_PROGRESS'; sectionId: string; progress: number }
  | { type: 'WORKSPACE_LOADING'; sectionId: string }
  | { type: 'ACTIVE_FILE_CHANGED'; sectionId: string; activeFile: string }
  | { type: 'WORKSPACE_READY'; sectionId: string; activeFile: string }
  | { type: 'COMMAND_DISPATCHED'; sectionId: string }
  | { type: 'COMMAND_FINISHED' }
  | { type: 'FAILED'; message: string }
  | { type: 'UNSUPPORTED' };

function clampProgress(value: number) {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

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
        bootStage: 'idle',
        bootProgress: 0,
        sectionId: event.sectionId,
        activeFile: null,
        error: null
      };
    case 'BOOT_STAGE_CHANGED': {
      const nextProgress =
        typeof event.progress === 'number'
          ? Math.max(state.bootProgress, clampProgress(event.progress))
          : state.bootProgress;
      return {
        ...state,
        status: event.status,
        bootStage: event.bootStage,
        bootProgress: nextProgress,
        sectionId: event.sectionId,
        error: null
      };
    }
    case 'BOOT_PROGRESS':
      return {
        ...state,
        bootProgress: Math.max(state.bootProgress, clampProgress(event.progress)),
        sectionId: event.sectionId
      };
    case 'WORKSPACE_LOADING':
      return {
        ...state,
        status: 'loading',
        sectionId: event.sectionId,
        activeFile: null,
        error: null
      };
    case 'ACTIVE_FILE_CHANGED':
      return {
        ...state,
        sectionId: event.sectionId,
        activeFile: event.activeFile,
        error: null
      };
    case 'WORKSPACE_READY':
      return {
        ...state,
        status: 'ready',
        bootStage: 'ready',
        bootProgress: 100,
        sectionId: event.sectionId,
        activeFile: event.activeFile,
        error: null
      };
    case 'COMMAND_DISPATCHED':
      return {
        ...state,
        status: 'running',
        bootStage: 'ready',
        bootProgress: 100,
        sectionId: event.sectionId
      };
    case 'COMMAND_FINISHED':
      return {
        ...state,
        status: 'ready',
        bootStage: 'ready',
        bootProgress: 100
      };
    case 'FAILED':
      return {
        ...state,
        status: 'error',
        bootStage: 'idle',
        bootProgress: 0,
        error: event.message
      };
    case 'UNSUPPORTED':
      return {
        ...state,
        status: 'unsupported',
        bootStage: 'idle',
        bootProgress: 0,
        error: 'WebContainers require a compatible desktop browser.'
      };
    default:
      return state;
  }
}
