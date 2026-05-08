'use client';

import React from 'react';
import type { PlaygroundFileEntry } from './playground-provider';

interface PlaygroundFileTreeProps {
  files: PlaygroundFileEntry[];
  activeFile: string | null;
  onSelectFile: (path: string) => Promise<void>;
}

export function PlaygroundFileTree({
  files,
  activeFile,
  onSelectFile
}: PlaygroundFileTreeProps) {
  return (
    <nav className="ha-playground-tree" aria-label="Workspace files">
      {files.length > 0 ? (
        files.map((file) => (
          <button
            key={file.path}
            type="button"
            className={file.path === activeFile ? 'is-active' : ''}
            onClick={() => {
              void onSelectFile(file.path);
            }}
          >
            {file.path}
          </button>
        ))
      ) : (
        <p className="ha-playground-empty">等待工作区加载…</p>
      )}
    </nav>
  );
}
