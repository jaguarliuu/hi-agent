import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useReducedMotion } from '@/app/lib/motion/use-reduced-motion';
import {
  installReducedMotionMock,
  type ReducedMotionMock,
} from '../helpers/motion-test-utils';

describe('useReducedMotion', () => {
  let mock: ReducedMotionMock;

  beforeEach(() => {
    mock = installReducedMotionMock(false);
  });

  afterEach(() => {
    mock.restore();
  });

  it('reflects an initially-true matchMedia after the mount effect runs', () => {
    mock.mediaQuery.matches = true;
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
      mock.mediaQuery.dispatch(true);
    });
    expect(result.current).toBe(true);

    act(() => {
      mock.mediaQuery.dispatch(false);
    });
    expect(result.current).toBe(false);
  });

  it('cleans up its listener on unmount', () => {
    const { unmount } = renderHook(() => useReducedMotion());

    expect(mock.mediaQuery.listeners.size).toBe(1);
    unmount();
    expect(mock.mediaQuery.listeners.size).toBe(0);
  });

  it('does not throw when window.matchMedia is unavailable', () => {
    mock.restore();
    // @ts-expect-error - simulate hostile environment
    delete window.matchMedia;

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });
});
