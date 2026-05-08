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
import { getPlaygroundManifest } from './manifest-loader';
import type { PlaygroundManifest } from './manifest-schema';
import {
  initialPlaygroundState,
  playgroundReducer,
  type PlaygroundState
} from './playground-state';
import {
  getWebcontainer,
  listWorkspaceFiles,
  prepareSectionWorkspace,
  readWorkspaceFile,
  runManifestCommand,
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

function toFileEntries(files: string[]) {
  return files.map((path) => ({ path }));
}

const LazyPlaygroundDrawer = dynamic(
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
  const [isOpen, setIsOpen] = useState(false);
  const [manifest, setManifest] = useState<PlaygroundManifest | null>(null);
  const [files, setFiles] = useState<PlaygroundFileEntry[]>([]);
  const [activeFileContent, setActiveFileContent] = useState('');
  const [activeFileAnchor, setActiveFileAnchor] = useState<string | null>(null);
  const activeRequestIdRef = useRef(0);

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
        type: 'WORKSPACE_READY',
        sectionId,
        activeFile: path
      });
    });
    return true;
  }

  async function openSection(sectionId: string, mode: OpenMode, blockId?: string) {
    const nextManifest = getPlaygroundManifest(sectionId);
    const requestId = startOpenRequest(sectionId);
    startTransition(() => {
      setManifest(nextManifest);
      setIsOpen(true);
    });

    if (!window.crossOriginIsolated) {
      startTransition(() => {
        if (isActiveRequest(requestId)) {
          dispatch({ type: 'UNSUPPORTED' });
        }
      });
      return;
    }

    try {
      dispatch({ type: 'BOOT_STARTED', sectionId });
      await getWebcontainer();

      if (!isActiveRequest(requestId)) {
        return;
      }

      dispatch({ type: 'WORKSPACE_LOADING', sectionId });

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

      if (mode === 'command' && blockId) {
        dispatch({ type: 'COMMAND_STARTED', sectionId });
        const exitCode = await runManifestCommand(nextManifest, blockId, (chunk) => {
          if (isActiveRequest(requestId)) {
            dispatch({ type: 'COMMAND_OUTPUT', chunk });
          }
        });

        if (!isActiveRequest(requestId)) {
          return;
        }

        if (exitCode !== 0) {
          dispatch({
            type: 'FAILED',
            message: `Command failed with exit code ${exitCode}`
          });
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
    closeDrawer: () => {
      activeRequestIdRef.current += 1;
      setIsOpen(false);
    },
    selectFile,
    updateActiveFile
  };

  return (
    <PlaygroundContext.Provider value={value}>
      {children}
      {isOpen ? <LazyPlaygroundDrawer /> : null}
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
