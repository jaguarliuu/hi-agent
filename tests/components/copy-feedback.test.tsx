import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyFeedbackButton } from '@/app/lib/motion/copy-feedback-button';
import { ToastProvider } from '@/app/lib/motion/toast-context';

function renderWithToasts(ui: React.ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

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

  it('always renders the idle copy label and never mutates its text on success', async () => {
    renderWithToasts(<CopyFeedbackButton content="npm install" />);

    const button = screen.getByRole('button', { name: '复制代码' });
    expect(button).toHaveAttribute('title', '复制代码');
    expect(button).toHaveTextContent('复制');

    await act(async () => {
      fireEvent.click(button);
    });

    expect(writeText).toHaveBeenCalledWith('npm install');

    expect(screen.getByRole('button', { name: '复制代码' })).toHaveTextContent(
      '复制'
    );
    expect(screen.queryByText('✓ 已复制')).not.toBeInTheDocument();
  });

  it('emits a success toast after copying succeeds', async () => {
    renderWithToasts(<CopyFeedbackButton content="npm install" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '复制代码' }));
    });

    const toast = screen.getByRole('status');
    expect(toast).toHaveTextContent('已复制到剪贴板');
    expect(toast).toHaveAttribute('data-tone', 'success');
  });

  it('emits an error toast and keeps the idle label when clipboard write fails', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      renderWithToasts(<CopyFeedbackButton content="npm install" />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '复制代码' }));
      });

      const toast = screen.getByRole('status');
      expect(toast).toHaveTextContent('复制失败');
      expect(toast).toHaveAttribute('data-tone', 'error');

      expect(consoleError).toHaveBeenCalledWith(
        'Failed to copy code.',
        expect.any(Error)
      );

      expect(
        screen.getByRole('button', { name: '复制代码' })
      ).toHaveTextContent('复制');
    } finally {
      consoleError.mockRestore();
    }
  });

  it('falls back to an error toast when navigator.clipboard is unavailable', async () => {
    Reflect.deleteProperty(clipboardHost, 'clipboard');

    renderWithToasts(<CopyFeedbackButton content="npm install" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '复制代码' }));
    });

    const toast = screen.getByRole('status');
    expect(toast).toHaveTextContent('复制失败');
    expect(toast).toHaveAttribute('data-tone', 'error');
  });
});
