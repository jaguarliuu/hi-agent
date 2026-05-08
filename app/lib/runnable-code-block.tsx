'use client';

import React, { type ReactNode } from 'react';
import { usePlayground } from './playground/playground-provider';
import { usePlaygroundSection } from './playground/playground-section';

type RunnableActionKind = 'command' | 'file';

interface RunnableCodeBlockProps {
  blockId: string;
  actionKind?: RunnableActionKind;
  actionLabel?: string;
  children: ReactNode;
}

export function RunnableCodeBlock({
  blockId,
  actionKind = 'file',
  actionLabel = '打开编辑器',
  children
}: RunnableCodeBlockProps) {
  const { runCommand, openFile } = usePlayground();
  const { sectionId } = usePlaygroundSection();

  function handleAction() {
    if (actionKind === 'command') {
      void runCommand(sectionId, blockId);
      return;
    }

    void openFile(sectionId, blockId);
  }

  return (
    <div className="ha-runnable-block">
      <div className="ha-runnable-block-toolbar">
        <button
          type="button"
          className="ha-runnable-block-action"
          onClick={handleAction}
        >
          {actionLabel}
        </button>
      </div>
      {children}
    </div>
  );
}
