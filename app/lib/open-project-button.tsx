'use client';

import React, { type ReactNode } from 'react';
import { usePlayground } from './playground/playground-provider';
import { usePlaygroundSection } from './playground/playground-section';

interface OpenProjectButtonProps {
  blockId?: string;
  children?: ReactNode;
}

function EditorIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="ha-open-project-button-icon"
    >
      <path
        d="M2.75 3.5h3M2.75 6.5h2M2.75 9.5h2M7.75 11.5l1.9-.35 3.35-3.35a1.1 1.1 0 0 0 0-1.55l-.3-.3a1.1 1.1 0 0 0-1.55 0L7.8 9.3l-.05 2.2Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.35"
      />
    </svg>
  );
}

export function OpenProjectButton({
  blockId,
  children
}: OpenProjectButtonProps) {
  const { isOpen, openProject } = usePlayground();
  const { sectionId } = usePlaygroundSection();

  if (isOpen) {
    return null;
  }

  return (
    <button
      type="button"
      className="ha-open-project-button"
      data-block-id={blockId}
      onClick={() => {
        void openProject(sectionId);
      }}
    >
      <EditorIcon />
      <span>{children ?? '编辑器'}</span>
    </button>
  );
}
