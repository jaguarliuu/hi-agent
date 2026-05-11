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

function ActionIcon({ kind }: { kind: RunnableActionKind }) {
  if (kind === 'command') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="ha-runnable-block-action-icon"
      >
        <path d="M5 3.75v8.5L12 8 5 3.75Z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="ha-runnable-block-action-icon"
    >
      <path
        d="M5.25 4 2.5 8l2.75 4M10.75 4 13.5 8l-2.75 4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function RunnableCodeBlock({
  blockId,
  actionKind = 'file',
  actionLabel = '应用',
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
    <div className="ha-runnable-block" data-action-kind={actionKind}>
      <div className="ha-runnable-block-toolbar">
        <button
          type="button"
          className="ha-runnable-block-action"
          onClick={handleAction}
        >
          <ActionIcon kind={actionKind} />
          {actionLabel}
        </button>
      </div>
      {children}
    </div>
  );
}
