'use client';

import React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Button } from 'nextra/components';

const IDLE_TEXT = '复制';
const IDLE_LABEL = '复制代码';
const COPIED_TEXT = '✓ 已复制';
const COPIED_LABEL = '✓ 已复制';
const ERROR_TEXT = '复制失败';
const ERROR_LABEL = '复制失败';
const RESET_DELAY_MS = 1500;

type CopyState = 'idle' | 'copied' | 'error';

interface CopyFeedbackButtonProps {
  className?: string;
  content: string;
}

export function CopyFeedbackButton({
  className,
  content,
}: CopyFeedbackButtonProps) {
  const [state, setState] = useState<CopyState>('idle');
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const label =
    state === 'copied'
      ? COPIED_LABEL
      : state === 'error'
        ? ERROR_LABEL
        : IDLE_LABEL;
  const text =
    state === 'copied'
      ? COPIED_TEXT
      : state === 'error'
        ? ERROR_TEXT
        : IDLE_TEXT;

  function scheduleReset(nextState: Exclude<CopyState, 'idle'>) {
    setState(nextState);

    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = window.setTimeout(() => {
      setState('idle');
      resetTimerRef.current = null;
    }, RESET_DELAY_MS);
  }

  async function handleClick() {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      scheduleReset('error');
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      scheduleReset('copied');
    } catch (error) {
      console.error('Failed to copy code.', error);
      scheduleReset('error');
    }
  }

  return (
    <Button
      aria-label={label}
      className={className}
      data-copy-state={state}
      onClick={handleClick}
      title={label}
      type="button"
      variant="outline"
    >
      <span className="ha-copy-feedback-label">{text}</span>
    </Button>
  );
}
