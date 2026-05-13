'use client';

import React from 'react';
import { Button } from 'nextra/components';
import { useToast } from './toast-context';

const BUTTON_LABEL = '复制代码';
const BUTTON_TEXT = '复制';
const SUCCESS_MESSAGE = '已复制到剪贴板';
const ERROR_MESSAGE = '复制失败，请手动选中代码';

interface CopyFeedbackButtonProps {
  className?: string;
  content: string;
}

export function CopyFeedbackButton({
  className,
  content,
}: CopyFeedbackButtonProps) {
  const { showToast } = useToast();

  async function handleClick() {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      showToast(ERROR_MESSAGE, { tone: 'error' });
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      showToast(SUCCESS_MESSAGE, { tone: 'success' });
    } catch (error) {
      console.error('Failed to copy code.', error);
      showToast(ERROR_MESSAGE, { tone: 'error' });
    }
  }

  return (
    <Button
      aria-label={BUTTON_LABEL}
      className={className}
      onClick={handleClick}
      title={BUTTON_LABEL}
      type="button"
      variant="outline"
    >
      <span className="ha-copy-feedback-label">{BUTTON_TEXT}</span>
    </Button>
  );
}
