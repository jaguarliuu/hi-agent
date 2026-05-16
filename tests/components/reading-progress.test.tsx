import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { pathnameState } = vi.hoisted(() => ({
  pathnameState: { value: '/' },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameState.value,
}));

function setPageMetrics({
  scrollHeight,
  innerHeight,
  scrollY,
}: {
  scrollHeight: number;
  innerHeight: number;
  scrollY: number;
}) {
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    value: scrollHeight,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: innerHeight,
  });
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    value: scrollY,
  });
}

describe('<ReadingProgress>', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    pathnameState.value = '/';
    setPageMetrics({ scrollHeight: 2000, innerHeight: 500, scrollY: 0 });
  });

  it('hides on landing and module index routes, and shows on article routes', async () => {
    const { ReadingProgress } = await import('@/app/lib/reading-progress');

    const { rerender } = render(<ReadingProgress />);
    expect(screen.queryByTestId('reading-progress')).toBeNull();

    pathnameState.value = '/courses/hi-agent/chat';
    rerender(<ReadingProgress />);
    expect(screen.queryByTestId('reading-progress')).toBeNull();

    pathnameState.value = '/courses/hi-agent/chat/agent-loop';
    rerender(<ReadingProgress />);

    expect(screen.getByTestId('reading-progress')).toHaveAttribute(
      'data-visible',
      'true'
    );
  });

  it('updates progress from scroll position only after the RAF-throttled measurement runs', async () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameMock = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        rafCallbacks.push(callback);
        return rafCallbacks.length;
      });

    try {
      pathnameState.value = '/courses/hi-agent/chat/agent-loop';
      const { ReadingProgress } = await import('@/app/lib/reading-progress');
      render(<ReadingProgress />);

      const bar = screen.getByTestId('reading-progress');
      expect(bar.style.transform).toBe('scaleX(0)');

      setPageMetrics({ scrollHeight: 2000, innerHeight: 500, scrollY: 750 });
      fireEvent.scroll(window);

      expect(bar.style.transform).toBe('scaleX(0)');
      expect(rafCallbacks).toHaveLength(1);

      await act(async () => {
        const callback = rafCallbacks.shift();
        if (!callback) {
          throw new Error('Missing queued RAF callback');
        }
        callback(16);
      });

      expect(bar.style.transform).toBe('scaleX(0.5)');
    } finally {
      requestAnimationFrameMock.mockRestore();
    }
  });

  it('queues at most one RAF while a measurement is already pending', async () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameMock = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        rafCallbacks.push(callback);
        return rafCallbacks.length;
      });

    try {
      pathnameState.value = '/courses/hi-agent/chat/agent-loop';
      const { ReadingProgress } = await import('@/app/lib/reading-progress');
      render(<ReadingProgress />);

      setPageMetrics({ scrollHeight: 2000, innerHeight: 500, scrollY: 750 });
      fireEvent.scroll(window);
      fireEvent.scroll(window);
      fireEvent(window, new Event('resize'));

      expect(rafCallbacks).toHaveLength(1);
    } finally {
      requestAnimationFrameMock.mockRestore();
    }
  });

  it('measures the current progress immediately on mount and when the article pathname changes', async () => {
    pathnameState.value = '/courses/hi-agent/chat/agent-loop';
    setPageMetrics({ scrollHeight: 2000, innerHeight: 500, scrollY: 750 });

    const { ReadingProgress } = await import('@/app/lib/reading-progress');
    const { rerender } = render(<ReadingProgress />);

    expect(screen.getByTestId('reading-progress').style.transform).toBe(
      'scaleX(0.5)'
    );

    pathnameState.value = '/courses/hi-agent/chat/tool-calling';
    setPageMetrics({ scrollHeight: 2000, innerHeight: 500, scrollY: 300 });
    rerender(<ReadingProgress />);

    expect(screen.getByTestId('reading-progress').style.transform).toBe(
      'scaleX(0.2)'
    );
  });

  it('pauses progress updates while the document is hidden and recomputes once visible again', async () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameMock = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        rafCallbacks.push(callback);
        return rafCallbacks.length;
      });

    let hidden = false;
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden,
    });

    try {
      pathnameState.value = '/courses/hi-agent/labs/01-webcontainers-pilot';
      const { ReadingProgress } = await import('@/app/lib/reading-progress');
      render(<ReadingProgress />);

      const bar = screen.getByTestId('reading-progress');
      expect(bar.style.transform).toBe('scaleX(0)');

      hidden = true;
      setPageMetrics({ scrollHeight: 2000, innerHeight: 500, scrollY: 900 });
      fireEvent.scroll(window);

      expect(rafCallbacks).toHaveLength(0);
      expect(bar.style.transform).toBe('scaleX(0)');

      hidden = false;
      fireEvent(document, new Event('visibilitychange'));

      expect(rafCallbacks).toHaveLength(0);

      expect(bar.style.transform).toBe('scaleX(0.6)');
    } finally {
      requestAnimationFrameMock.mockRestore();
    }
  });

  it('cancels a queued measurement if the document becomes hidden before the RAF runs', async () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameMock = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        rafCallbacks.push(callback);
        return rafCallbacks.length;
      });
    const cancelAnimationFrameMock = vi.spyOn(window, 'cancelAnimationFrame');

    let hidden = false;
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden,
    });

    try {
      pathnameState.value = '/courses/hi-agent/labs/01-webcontainers-pilot';
      const { ReadingProgress } = await import('@/app/lib/reading-progress');
      render(<ReadingProgress />);

      const bar = screen.getByTestId('reading-progress');

      setPageMetrics({ scrollHeight: 2000, innerHeight: 500, scrollY: 450 });
      fireEvent.scroll(window);

      expect(rafCallbacks).toHaveLength(1);

      hidden = true;
      fireEvent(document, new Event('visibilitychange'));

      expect(cancelAnimationFrameMock).toHaveBeenCalledTimes(1);

      await act(async () => {
        const callback = rafCallbacks.shift();
        if (!callback) {
          throw new Error('Missing queued RAF callback');
        }
        callback(16);
      });

      expect(bar.style.transform).toBe('scaleX(0)');
    } finally {
      requestAnimationFrameMock.mockRestore();
      cancelAnimationFrameMock.mockRestore();
    }
  });
});
