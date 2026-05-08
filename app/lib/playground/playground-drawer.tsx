'use client';

import React from 'react';
import { usePlayground } from './playground-provider';
import { PlaygroundEditor } from './playground-editor';
import { PlaygroundFileTree } from './playground-file-tree';
import { PlaygroundOutputPanel } from './playground-output-panel';

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

  const title = manifest?.title ?? 'Runnable Example';

  return (
    <aside className="ha-playground is-open" aria-label="Runnable playground">
      <header className="ha-playground-header">
        <div className="ha-playground-heading">
          <h2>{title}</h2>
          <span className={`ha-playground-status status-${state.status}`}>
            {state.status}
          </span>
        </div>
        <button
          type="button"
          className="ha-playground-close"
          onClick={closeDrawer}
          aria-label="关闭"
        >
          关闭
        </button>
      </header>

      <div className="ha-playground-body">
        <PlaygroundFileTree
          files={files}
          activeFile={state.activeFile}
          onSelectFile={selectFile}
        />

        <div className="ha-playground-main">
          <div className="ha-playground-editor-shell" data-active-file={state.activeFile ?? ''}>
            <PlaygroundEditor
              path={state.activeFile}
              value={activeFileContent}
              anchor={activeFileAnchor}
              onChange={updateActiveFile}
            />
          </div>
          <PlaygroundOutputPanel output={state.output} error={state.error} />
        </div>
      </div>
    </aside>
  );
}
