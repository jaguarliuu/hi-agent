'use client';

import dynamic from 'next/dynamic';
import React, {
  createContext,
  startTransition,
  useContext,
  useReducer,
  useRef,
  useState,
  type ReactNode
} from 'react';
import type { PlaygroundDrawerProps } from './playground-drawer';
import { getPlaygroundManifest } from './manifest-loader';
import type { PlaygroundManifest } from './manifest-schema';
import {
  initialPlaygroundState,
  playgroundReducer,
  type PlaygroundBootStage,
  type PlaygroundState
} from './playground-state';
import {
  ensureInteractiveShell,
  getWebcontainer,
  listWorkspaceFiles,
  prepareSectionWorkspace,
  readWorkspaceFile,
  runManifestCommand,
  teardownInteractiveShell,
  writeWorkspaceFile
} from './webcontainer-manager';

export interface PlaygroundFileEntry {
  path: string;
}

export interface PlaygroundContextValue {
  isOpen: boolean;
  manifest: PlaygroundManifest | null;
  state: PlaygroundState;
  files: PlaygroundFileEntry[];
  activeFileContent: string;
  activeFileAnchor: string | null;
  openProject: (sectionId: string) => Promise<void>;
  runCommand: (sectionId: string, blockId: string) => Promise<void>;
  openFile: (sectionId: string, blockId: string) => Promise<void>;
  closeDrawer: () => void;
  selectFile: (path: string) => Promise<void>;
  updateActiveFile: (next: string) => Promise<void>;
}

export const PlaygroundContext = createContext<PlaygroundContextValue | null>(null);

interface PlaygroundProviderProps {
  children: ReactNode;
}

type OpenMode = 'project' | 'command' | 'file';
type DrawerPhase = 'closed' | PlaygroundDrawerProps['phase'];

function toFileEntries(files: string[]) {
  return files.map((path) => ({ path }));
}

const BOOT_STAGE_MIN_VISIBLE_MS = 160;

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

const LazyPlaygroundDrawer = dynamic<PlaygroundDrawerProps>(
  () =>
    import('./playground-drawer').then((module) => ({
      default: module.PlaygroundDrawer
    })),
  {
    loading: () => null,
    ssr: false
  }
);

export function PlaygroundProvider({ children }: PlaygroundProviderProps) {
  const [state, dispatch] = useReducer(playgroundReducer, initialPlaygroundState);
  const [drawerPhase, setDrawerPhase] = useState<DrawerPhase>('closed');
  const [manifest, setManifest] = useState<PlaygroundManifest | null>(null);
  const [files, setFiles] = useState<PlaygroundFileEntry[]>([]);
  const [activeFileContent, setActiveFileContent] = useState('');
  const [activeFileAnchor, setActiveFileAnchor] = useState<string | null>(null);
  const activeRequestIdRef = useRef(0);
  const isDrawerVisible = drawerPhase !== 'closed';
  const isOpen = isDrawerVisible;

  function resetDrawerState(sectionId: string) {
    setFiles([]);
    setActiveFileContent('');
    setActiveFileAnchor(null);
    dispatch({ type: 'RESET', sectionId });
  }

  function startOpenRequest(sectionId: string) {
    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    resetDrawerState(sectionId);
    return requestId;
  }

  function isActiveRequest(requestId: number) {
    return requestId === activeRequestIdRef.current;
  }

  async function loadFile(
    path: string,
    anchor: string | null,
    sectionId: string,
    requestId: number
  ) {
    const content = await readWorkspaceFile(path);

    if (!isActiveRequest(requestId)) {
      return false;
    }

    startTransition(() => {
      setActiveFileContent(content);
      setActiveFileAnchor(anchor);
      dispatch({
        type: 'ACTIVE_FILE_CHANGED',
        sectionId,
        activeFile: path
      });
    });
    return true;
  }

  async function openSection(sectionId: string, mode: OpenMode, blockId?: string) {
    const nextManifest = getPlaygroundManifest(sectionId);
    const requestId = startOpenRequest(sectionId);
    let lastBootStageAt = 0;

    async function waitForBootStageVisibility() {
      if (lastBootStageAt === 0) {
        return isActiveRequest(requestId);
      }

      const elapsed = performance.now() - lastBootStageAt;
      if (elapsed < BOOT_STAGE_MIN_VISIBLE_MS) {
        await sleep(BOOT_STAGE_MIN_VISIBLE_MS - elapsed);
      }

      return isActiveRequest(requestId);
    }

    async function advanceBootStage(
      bootStage: Exclude<PlaygroundBootStage, 'idle' | 'ready'>,
      status: 'booting' | 'loading'
    ) {
      if (!(await waitForBootStageVisibility())) {
        return false;
      }

      dispatch({
        type: 'BOOT_STAGE_CHANGED',
        sectionId,
        bootStage,
        status
      });
      lastBootStageAt = performance.now();
      return true;
    }

    startTransition(() => {
      setManifest(nextManifest);
      setDrawerPhase((current) => {
        if (current === 'closed' || current === 'closing') {
          return 'opening';
        }
        return current;
      });
    });

    try {
      dispatch({ type: 'BOOT_STARTED', sectionId });
      if (!(await advanceBootStage('prelude', 'booting'))) {
        return;
      }

      if (!window.crossOriginIsolated) {
        startTransition(() => {
          if (isActiveRequest(requestId)) {
            dispatch({ type: 'UNSUPPORTED' });
          }
        });
        return;
      }

      if (!(await advanceBootStage('loading-kernel', 'booting'))) {
        return;
      }

      await getWebcontainer();

      if (!isActiveRequest(requestId)) {
        return;
      }

      if (!(await advanceBootStage('mounting-snapshot', 'loading'))) {
        return;
      }

      await prepareSectionWorkspace(nextManifest);
      if (!isActiveRequest(requestId)) {
        return;
      }

      const workspaceFiles = await listWorkspaceFiles();

      if (!isActiveRequest(requestId)) {
        return;
      }

      startTransition(() => {
        setFiles(toFileEntries(workspaceFiles));
      });

      const fileBlock =
        mode === 'file'
          ? nextManifest.blocks.find(
              (entry) => entry.blockId === blockId && entry.type === 'file-snippet'
            )
          : null;
      const targetPath =
        fileBlock && fileBlock.type === 'file-snippet'
          ? fileBlock.path
          : nextManifest.defaultOpenFile;
      const targetAnchor =
        fileBlock && fileBlock.type === 'file-snippet' ? fileBlock.anchor : null;

      const didLoadFile = await loadFile(
        targetPath,
        targetAnchor,
        sectionId,
        requestId
      );

      if (!didLoadFile || !isActiveRequest(requestId)) {
        return;
      }

      if (!(await advanceBootStage('starting-shell', 'loading'))) {
        return;
      }

      await ensureInteractiveShell(sectionId);

      if (!isActiveRequest(requestId)) {
        return;
      }

      if (!(await waitForBootStageVisibility())) {
        return;
      }

      dispatch({
        type: 'WORKSPACE_READY',
        sectionId,
        activeFile: targetPath
      });

      if (mode === 'command' && blockId) {
        dispatch({ type: 'COMMAND_DISPATCHED', sectionId });
        await runManifestCommand(nextManifest, blockId);

        if (!isActiveRequest(requestId)) {
          return;
        }

        dispatch({ type: 'COMMAND_FINISHED' });
      }
    } catch (error) {
      if (!isActiveRequest(requestId)) {
        return;
      }

      dispatch({
        type: 'FAILED',
        message: error instanceof Error ? error.message : 'Playground failed to start.'
      });
    }
  }

  async function selectFile(path: string) {
    if (!state.sectionId) {
      return;
    }

    await loadFile(path, null, state.sectionId, activeRequestIdRef.current);
  }

  async function updateActiveFile(next: string) {
    if (!state.activeFile) {
      return;
    }

    startTransition(() => {
      setActiveFileContent(next);
    });
    await writeWorkspaceFile(state.activeFile, next);
  }

  function closeDrawer() {
    activeRequestIdRef.current += 1;
    void teardownInteractiveShell();
    setDrawerPhase((current) => {
      if (current === 'closed') {
        return current;
      }
      return 'closing';
    });
  }

  function handleDrawerPhaseComplete(phase: PlaygroundDrawerProps['phase']) {
    setDrawerPhase((current) => {
      if (phase === 'opening' && current === 'opening') {
        return 'open';
      }
      if (phase === 'closing' && current === 'closing') {
        return 'closed';
      }
      return current;
    });
  }

  const value: PlaygroundContextValue = {
    isOpen,
    manifest,
    state,
    files,
    activeFileContent,
    activeFileAnchor,
    openProject: (sectionId) => openSection(sectionId, 'project'),
    runCommand: (sectionId, blockId) => openSection(sectionId, 'command', blockId),
    openFile: (sectionId, blockId) => openSection(sectionId, 'file', blockId),
    closeDrawer,
    selectFile,
    updateActiveFile
  };

  return (
    <PlaygroundContext.Provider value={value}>
      {children}
      {isDrawerVisible ? (
        <LazyPlaygroundDrawer
          phase={drawerPhase}
          onPhaseComplete={handleDrawerPhaseComplete}
        />
      ) : null}
    </PlaygroundContext.Provider>
  );
}

export function usePlayground() {
  const context = useContext(PlaygroundContext);
  if (!context) {
    throw new Error('usePlayground must be used within PlaygroundProvider');
  }
  return context;
}
