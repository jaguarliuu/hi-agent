'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../motion/use-reduced-motion';
import { usePlayground } from './playground-provider';
import { PlaygroundEditor } from './playground-editor';
import { PlaygroundFileTree } from './playground-file-tree';
import { PlaygroundTerminal } from './playground-terminal';
import { usePlaygroundTheme } from './use-playground-theme';

export interface PlaygroundDrawerProps {
  phase: 'opening' | 'open' | 'closing';
  onPhaseComplete: (phase: 'opening' | 'open' | 'closing') => void;
}

const DRAWER_WIDTH_STORAGE_KEY = 'ha-playground-drawer-width';
const MIN_DRAWER_WIDTH = 480;

export function PlaygroundDrawer({
  phase,
  onPhaseComplete
}: PlaygroundDrawerProps) {
  const {
    manifest,
    state,
    files,
    activeFileContent,
    activeFileAnchor,
    closeDrawer,
    selectFile,
    updateActiveFile,
    createFile
  } = usePlayground();
  const [terminalVisible, setTerminalVisible] = useState(true);
  const [isTransitionActive, setIsTransitionActive] = useState(false);
  const [drawerWidth, setDrawerWidth] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const theme = usePlaygroundTheme();
  const reducedMotion = useReducedMotion();
  const latestPhaseRef = useRef(phase);
  const latestOnPhaseCompleteRef = useRef(onPhaseComplete);
  const latestTransitionActiveRef = useRef(isTransitionActive);
  const drawerRef = useRef<HTMLElement | null>(null);

  latestPhaseRef.current = phase;
  latestOnPhaseCompleteRef.current = onPhaseComplete;
  latestTransitionActiveRef.current = isTransitionActive;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(DRAWER_WIDTH_STORAGE_KEY);
    if (!stored) return;
    const parsed = Number.parseInt(stored, 10);
    if (Number.isFinite(parsed) && parsed >= MIN_DRAWER_WIDTH) {
      setDrawerWidth(parsed);
    }
  }, []);

  const startResize = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    setIsResizing(true);

    const maxWidth = window.innerWidth * 0.96;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const next = Math.min(
        Math.max(window.innerWidth - moveEvent.clientX, MIN_DRAWER_WIDTH),
        maxWidth
      );
      setDrawerWidth(next);
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      handle.removeEventListener('pointermove', handlePointerMove);
      handle.removeEventListener('pointerup', handlePointerUp);
      handle.removeEventListener('pointercancel', handlePointerUp);
      try {
        handle.releasePointerCapture(event.pointerId);
      } catch {}
      setDrawerWidth((current) => {
        if (current !== null) {
          window.localStorage.setItem(
            DRAWER_WIDTH_STORAGE_KEY,
            String(Math.round(current))
          );
        }
        return current;
      });
    };

    handle.addEventListener('pointermove', handlePointerMove);
    handle.addEventListener('pointerup', handlePointerUp);
    handle.addEventListener('pointercancel', handlePointerUp);
  }, []);

  function openCreateDialog() {
    setNewFileName('.env');
    setCreateError(null);
    setCreateDialogOpen(true);
  }

  function closeCreateDialog() {
    setCreateDialogOpen(false);
    setNewFileName('');
    setCreateError(null);
  }

  async function handleCreateFile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = newFileName.trim();
    if (!value) {
      setCreateError('请填写文件名');
      return;
    }
    try {
      await createFile(value);
      closeCreateDialog();
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : '创建失败，请重试。'
      );
    }
  }

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const body = document.body;
    const html = document.documentElement;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = html.style.overflow;
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    html.dataset.haPlayground = 'open';
    return () => {
      body.style.overflow = previousBodyOverflow;
      html.style.overflow = previousHtmlOverflow;
      delete html.dataset.haPlayground;
    };
  }, []);

  useEffect(() => {
    if (phase === 'open') {
      setIsTransitionActive(true);
      return;
    }

    if (phase === 'opening') {
      if (reducedMotion) {
        setIsTransitionActive(true);
        latestOnPhaseCompleteRef.current('opening');
        return;
      }

      setIsTransitionActive(false);
      const rafId = window.requestAnimationFrame(() => {
        setIsTransitionActive(true);
      });

      return () => {
        window.cancelAnimationFrame(rafId);
      };
    }

    const needsImmediateCloseCompletion =
      reducedMotion || latestTransitionActiveRef.current === false;

    setIsTransitionActive(false);

    if (needsImmediateCloseCompletion) {
      const timeoutId = window.setTimeout(() => {
        latestOnPhaseCompleteRef.current('closing');
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }
  }, [phase, reducedMotion]);

  const title = manifest?.title ?? 'Runnable Example';
  const activeTabTitle = state.activeFile?.split('/').at(-1) ?? 'welcome.ts';
  const transitionState = isTransitionActive ? 'active' : 'idle';
  const bootStageLabel = getBootStageLabel(state.bootStage);

  function handleTransitionEnd(event: React.TransitionEvent<HTMLElement>) {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') {
      return;
    }

    const currentPhase = latestPhaseRef.current;
    if (currentPhase === 'opening' || currentPhase === 'closing') {
      latestOnPhaseCompleteRef.current(currentPhase);
    }
  }

  return (
    <>
      <div
        className="ha-playground-backdrop"
        data-playground-backdrop=""
        data-drawer-phase={phase}
        data-drawer-transition={transitionState}
        aria-hidden="true"
      />
      <aside
        className="ha-playground"
        ref={drawerRef}
        data-playground-theme={theme}
        data-drawer-phase={phase}
        data-drawer-transition={transitionState}
        data-resizing={isResizing ? 'true' : 'false'}
        aria-label="Runnable playground"
        onTransitionEnd={handleTransitionEnd}
        style={
          drawerWidth !== null
            ? ({ ['--ha-playground-width' as string]: `${drawerWidth}px` } as React.CSSProperties)
            : undefined
        }
      >
        <button
          type="button"
          className="ha-playground-resize-handle"
          aria-label="拖动以调整 Playground 宽度"
          onPointerDown={startResize}
        />
        <header className="ha-playground-header">
          <div className="ha-playground-brand">
            <span className="ha-playground-brand-mark">{'</>'}</span>
            <h2>{title}</h2>
          </div>
          <div className="ha-playground-window-actions">
            <span
              className={`ha-playground-status status-${state.status}`}
              data-boot-stage={state.bootStage}
              data-status={state.status}
            >
              {bootStageLabel ?? state.status}
            </span>
            <button
              type="button"
              className="ha-playground-close"
              onClick={closeDrawer}
              aria-label="关闭"
            >
              关闭
            </button>
          </div>
        </header>

        <div className="ha-playground-body">
          <aside className="ha-playground-activity-rail" aria-label="Workbench">
            <button
              type="button"
              className="ha-playground-activity-button is-active"
              aria-label="资源管理器"
            >
              <ExplorerIcon />
            </button>
            <button
              type="button"
              className={`ha-playground-activity-button ${
                terminalVisible ? 'is-active' : ''
              }`}
              aria-label="终端"
              aria-pressed={terminalVisible}
              onClick={() => {
                setTerminalVisible((current) => !current);
              }}
            >
              <TerminalIcon />
            </button>
          </aside>

          <div className="ha-playground-sidebar">
            <div className="ha-playground-sidebar-header">
              <span>资源管理器</span>
              <div className="ha-playground-sidebar-header-actions">
                <button
                  type="button"
                  className="ha-playground-sidebar-action"
                  aria-label="新建文件"
                  title="新建文件"
                  onClick={openCreateDialog}
                >
                  <NewFileIcon />
                </button>
                <span className="ha-playground-sidebar-badge">WORKSPACE</span>
              </div>
            </div>
            <PlaygroundFileTree
              files={files}
              activeFile={state.activeFile}
              onSelectFile={selectFile}
            />
          </div>

          <div
            className="ha-playground-main"
            data-terminal-visible={terminalVisible ? 'true' : 'false'}
          >
            <div className="ha-playground-editor-pane">
              <div className="ha-playground-tabs">
                <button type="button" className="ha-playground-tab is-active">
                  <EditorTabIcon path={state.activeFile} />
                  <span>{activeTabTitle}</span>
                </button>
              </div>
              <div
                className="ha-playground-editor-shell"
                data-active-file={state.activeFile ?? ''}
              >
                <PlaygroundEditor
                  path={state.activeFile}
                  value={activeFileContent}
                  anchor={activeFileAnchor}
                  onChange={updateActiveFile}
                />
              </div>
            </div>

            {terminalVisible ? (
              <PlaygroundTerminal
                manifest={manifest}
                sectionId={state.sectionId}
                status={state.status}
              />
            ) : null}
          </div>
        </div>

        {createDialogOpen ? (
          <div
            className="ha-playground-dialog-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="新建文件"
            onClick={(event) => {
              if (event.target === event.currentTarget) closeCreateDialog();
            }}
          >
            <form className="ha-playground-dialog" onSubmit={handleCreateFile}>
              <h3>新建文件</h3>
              <p>输入相对工作区根目录的路径，例如 <code>.env</code> 或 <code>src/config.ts</code>。</p>
              <input
                autoFocus
                className="ha-playground-dialog-input"
                type="text"
                value={newFileName}
                placeholder=".env"
                onChange={(event) => {
                  setNewFileName(event.target.value);
                  setCreateError(null);
                }}
              />
              {createError ? (
                <p className="ha-playground-dialog-error" role="alert">
                  {createError}
                </p>
              ) : null}
              <div className="ha-playground-dialog-actions">
                <button
                  type="button"
                  className="ha-playground-dialog-button"
                  onClick={closeCreateDialog}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="ha-playground-dialog-button is-primary"
                >
                  创建
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </aside>
    </>
  );
}

function getBootStageLabel(
  bootStage: ReturnType<typeof usePlayground>['state']['bootStage']
) {
  switch (bootStage) {
    case 'prelude':
      return '启动前奏';
    case 'loading-kernel':
      return '加载内核';
    case 'mounting-snapshot':
      return '挂载快照';
    case 'starting-shell':
      return '启动终端';
    case 'ready':
      return '准备就绪';
    default:
      return null;
  }
}

function ExplorerIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <path
        d="M2.5 3.5h4l1 1.25h6v7.75H2.5z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.3"
      />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <path
        d="M3 4.5 6 7.5 3 10.5M8.25 10.5h4.75"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function NewFileIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <path
        d="M4 2.5h5l3 3v8H4z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.3"
      />
      <path
        d="M8 9v3M6.5 10.5h3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.3"
      />
    </svg>
  );
}

function EditorTabIcon({ path }: { path: string | null }) {
  let label = 'TXT';
  let variant = '';

  if (path?.endsWith('.ts') || path?.endsWith('.tsx')) {
    label = 'TS';
    variant = 'is-typescript';
  } else if (
    path?.endsWith('.js') ||
    path?.endsWith('.mjs') ||
    path?.endsWith('.cjs')
  ) {
    label = 'JS';
    variant = 'is-javascript';
  } else if (path?.endsWith('.json')) {
    label = '{}';
    variant = 'is-json';
  }

  return (
    <span className={`ha-playground-tab-icon ${variant}`} aria-hidden="true">
      {label}
    </span>
  );
}
