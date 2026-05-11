import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyFeedbackButton } from '@/app/lib/motion/copy-feedback-button';
import { withReducedMotion } from '@/tests/helpers/motion-test-utils';

describe('CopyFeedbackButton', () => {
  const clipboardHost = navigator as Navigator & {
    clipboard?: {
      writeText: ReturnType<typeof vi.fn>;
    };
  };

  let originalClipboard: typeof clipboardHost.clipboard;
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    originalClipboard = clipboardHost.clipboard;
    writeText = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(clipboardHost, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();

    if (originalClipboard) {
      Object.defineProperty(clipboardHost, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
      return;
    }

    Reflect.deleteProperty(clipboardHost, 'clipboard');
  });

  it('uses the default copy label and title before interaction', () => {
    render(<CopyFeedbackButton content="npm install" />);

    const button = screen.getByRole('button', { name: '复制代码' });

    expect(button).toHaveAttribute('title', '复制代码');
    expect(button).toHaveTextContent('复制');
    expect(button).not.toHaveTextContent('✓ 已复制');
  });

  it('copies content, shows success feedback, and restores the idle label after 1500ms', async () => {
    render(<CopyFeedbackButton content="npm install" />);

    const idleButton = screen.getByRole('button', { name: '复制代码' });

    await act(async () => {
      fireEvent.click(idleButton);
    });

    expect(writeText).toHaveBeenCalledWith('npm install');

    const copiedButton = screen.getByRole('button', { name: '✓ 已复制' });
    expect(copiedButton).toHaveAttribute('title', '✓ 已复制');
    expect(copiedButton).toHaveTextContent('✓ 已复制');

    act(() => {
      vi.advanceTimersByTime(1499);
    });

    expect(screen.getByRole('button', { name: '✓ 已复制' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    const resetButton = screen.getByRole('button', { name: '复制代码' });
    expect(resetButton).toHaveAttribute('title', '复制代码');
    expect(resetButton).toHaveTextContent('复制');
    expect(screen.queryByText('✓ 已复制')).not.toBeInTheDocument();
  });

  it('swaps to the success text immediately when reduced motion is enabled', async () => {
    await withReducedMotion(true, async () => {
      render(<CopyFeedbackButton content="npm install" />);

      const button = screen.getByRole('button', { name: '复制代码' });

      await act(async () => {
        fireEvent.click(button);
      });

      expect(writeText).toHaveBeenCalledWith('npm install');
      expect(screen.getByRole('button', { name: '✓ 已复制' })).toHaveTextContent(
        '✓ 已复制'
      );
    });
  });

  it('surfaces clipboard failures explicitly and then resets to idle', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      render(<CopyFeedbackButton content="npm install" />);

      const button = screen.getByRole('button', { name: '复制代码' });

      await act(async () => {
        fireEvent.click(button);
      });

      const errorButton = screen.getByRole('button', { name: '复制失败' });
      expect(errorButton).toHaveAttribute('title', '复制失败');
      expect(errorButton).toHaveTextContent('复制失败');
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to copy code.',
        expect.any(Error)
      );

      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(screen.getByRole('button', { name: '复制代码' })).toHaveTextContent(
        '复制'
      );
    } finally {
      consoleError.mockRestore();
    }
  });

});
