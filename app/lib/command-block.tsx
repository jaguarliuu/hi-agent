'use client';

import React, { type ReactNode } from 'react';
import { RunnableCodeBlock } from './runnable-code-block';

interface CommandBlockProps {
  blockId: string;
  actionLabel?: string;
  children: ReactNode;
}

export function CommandBlock({
  blockId,
  actionLabel = '运行',
  children
}: CommandBlockProps) {
  return (
    <RunnableCodeBlock
      blockId={blockId}
      actionKind="command"
      actionLabel={actionLabel}
    >
      {children}
    </RunnableCodeBlock>
  );
}
