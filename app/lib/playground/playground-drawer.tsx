'use client';

import React, { useState } from 'react';
import { usePlayground } from './playground-provider';
import { PlaygroundEditor } from './playground-editor';
import { PlaygroundFileTree } from './playground-file-tree';
import { PlaygroundTerminal } from './playground-terminal';
import { usePlaygroundTheme } from './use-playground-theme';

export function PlaygroundDrawer() {
  const {
    manifest,
    state,
    files,
    activeFileContent,
    activeFileAnchor,
    closeDrawer,
    selectFile,
    updateActiveFile
  } = usePlayground();
  const [terminalVisible, setTerminalVisible] = useState(true);
  const theme = usePlaygroundTheme();

  const title = manifest?.title ?? 'Runnable Example';
  const activeTabTitle = state.activeFile?.split('/').at(-1) ?? 'welcome.ts';

  return (
    <aside
      className="ha-playground is-open"
      data-playground-theme={theme}
      aria-label="Runnable playground"
    >
      <header className="ha-playground-header">
        <div className="ha-playground-brand">
          <span className="ha-playground-brand-mark">{'</>'}</span>
          <h2>{title}</h2>
        </div>
        <div className="ha-playground-window-actions">
          <span className={`ha-playground-status status-${state.status}`}>
            {state.status}
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
            <span className="ha-playground-sidebar-badge">WORKSPACE</span>
          </div>
          <PlaygroundFileTree
            files={files}
            activeFile={state.activeFile}
            onSelectFile={selectFile}
          />
        </div>

        <div className="ha-playground-main">
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
              sectionId={state.sectionId}
              status={state.status}
            />
          ) : null}
        </div>
      </div>
    </aside>
  );
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
