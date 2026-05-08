'use client';

import React, { type ReactNode } from 'react';
import { usePlayground } from './playground/playground-provider';
import { usePlaygroundSection } from './playground/playground-section';

interface OpenProjectButtonProps {
  blockId?: string;
  children?: ReactNode;
}

export function OpenProjectButton({
  blockId,
  children
}: OpenProjectButtonProps) {
  const { openProject } = usePlayground();
  const { sectionId } = usePlaygroundSection();

  return (
    <button
      type="button"
      className="ha-open-project-button"
      data-block-id={blockId}
      onClick={() => {
        void openProject(sectionId);
      }}
    >
      {children ?? '打开完整项目'}
    </button>
  );
}
