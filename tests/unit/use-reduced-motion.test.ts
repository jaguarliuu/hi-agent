import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useReducedMotion } from '@/app/lib/motion/use-reduced-motion';

interface FakeMediaQueryList {
  matches: boolean;
  media: string;
  listeners: Set<(event: MediaQueryListEvent) => void>;
  addEventListener: (
    type: 'change',
    cb: (event: MediaQueryListEvent) => void
  ) => void;
  removeEventListener: (
    type: 'change',
    cb: (event: MediaQueryListEvent) => void
  ) => void;
  dispatch: (matches: boolean) => void;
}

function createFakeMediaQueryList(initialMatches: boolean): FakeMediaQueryList {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const fake: FakeMediaQueryList = {
    matches: initialMatches,
    media: '(prefers-reduced-motion: reduce)',
    listeners,
    addEventListener: (_type, cb) => {
      listeners.add(cb);
    },
    removeEventListener: (_type, cb) => {
      listeners.delete(cb);
    },
    dispatch: (matches) => {
      fake.matches = matches;
      listeners.forEach((cb) =>
        cb({ matches } as unknown as MediaQueryListEvent)
      );
    }
  };
  return fake;
}

describe('useReducedMotion', () => {
  let mediaQuery: FakeMediaQueryList;
  let originalMatchMedia: typeof window.matchMedia | undefined;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    mediaQuery = createFakeMediaQueryList(false);
    window.matchMedia = vi.fn().mockReturnValue(mediaQuery) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    if (originalMatchMedia) {
      window.matchMedia = originalMatchMedia;
    } else {
      // @ts-expect-error - cleanup test artifact
      delete window.matchMedia;
    }
  });

  it('reflects an initially-true matchMedia after the mount effect runs', () => {
    mediaQuery.matches = true;
    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(true);
  });

  it('returns false when reduce-motion is not requested', () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('updates when the OS-level setting toggles mid-session', () => {
    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(false);

    act(() => {
      mediaQuery.dispatch(true);
    });
    expect(result.current).toBe(true);

    act(() => {
      mediaQuery.dispatch(false);
    });
    expect(result.current).toBe(false);
  });

  it('cleans up its listener on unmount', () => {
    const { unmount } = renderHook(() => useReducedMotion());

    expect(mediaQuery.listeners.size).toBe(1);
    unmount();
    expect(mediaQuery.listeners.size).toBe(0);
  });

  it('does not throw when window.matchMedia is unavailable', () => {
    // @ts-expect-error - simulate hostile environment
    delete window.matchMedia;

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });
});
