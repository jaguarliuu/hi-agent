import { act } from '@testing-library/react';
import { vi } from 'vitest';

/**
 * Shared test utilities for motion-related specs.
 *
 * The site's motion subsystem ships an SSR-safe `useReducedMotion()` hook
 * and a `<MotionProvider>` that both sit on top of `window.matchMedia`.
 * Unit tests therefore need to:
 *
 *   1. Control what `matchMedia(...)` reports at the moment the component
 *      mounts (initial value).
 *   2. Dispatch synthetic `change` events to simulate the OS flipping the
 *      preference mid-session.
 *   3. Advance CSS `transition` / `animation` completion deterministically
 *      in JSDOM — JSDOM does not fire `transitionend` on its own because
 *      it does not run the CSS engine.
 *
 * These helpers centralize those patterns so every new motion test does
 * not re-implement the mock.
 */

/**
 * Minimal but realistic shape of `MediaQueryList` the hooks rely on.
 * Exposes a `dispatch(matches)` method so tests can trigger change
 * handlers synchronously.
 */
export interface FakeMediaQueryList {
  matches: boolean;
  media: string;
  /**
   * Set of currently registered listeners. Tests assert against
   * `listeners.size` to verify cleanup on unmount.
   */
  listeners: Set<(event: MediaQueryListEvent) => void>;
  addEventListener: (
    type: 'change',
    cb: (event: MediaQueryListEvent) => void
  ) => void;
  removeEventListener: (
    type: 'change',
    cb: (event: MediaQueryListEvent) => void
  ) => void;
  /**
   * Update `matches` and invoke every registered listener synchronously.
   * Call inside `act(...)` to flush React state updates.
   */
  dispatch: (matches: boolean) => void;
}

/**
 * Factory for a controllable `MediaQueryList` double.
 *
 * @param initialMatches - the value returned by `matches` on first read.
 * @param media - the media string reported by the list. Defaults to the
 *   reduced-motion query used throughout the motion subsystem.
 */
export function createFakeMediaQueryList(
  initialMatches: boolean,
  media: string = '(prefers-reduced-motion: reduce)'
): FakeMediaQueryList {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const fake: FakeMediaQueryList = {
    matches: initialMatches,
    media,
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
    },
  };
  return fake;
}

/**
 * Handle returned by `installReducedMotionMock`. Call `.restore()` in
 * an `afterEach` (or use the `withReducedMotion` wrapper for auto
 * cleanup) to return `window.matchMedia` to its original value.
 */
export interface ReducedMotionMock {
  mediaQuery: FakeMediaQueryList;
  restore: () => void;
}

/**
 * Installs a `window.matchMedia` mock that answers the reduced-motion
 * query with the supplied value. Returns the fake list so tests can
 * dispatch subsequent changes via `mediaQuery.dispatch(newValue)`.
 *
 * Prefer `withReducedMotion` (below) when the mock should not outlive
 * a single test.
 */
export function installReducedMotionMock(initialMatches: boolean): ReducedMotionMock {
  const mediaQuery = createFakeMediaQueryList(initialMatches);
  const original = (window as { matchMedia?: typeof window.matchMedia }).matchMedia;

  window.matchMedia = vi
    .fn()
    .mockReturnValue(mediaQuery) as unknown as typeof window.matchMedia;

  return {
    mediaQuery,
    restore: () => {
      if (original) {
        window.matchMedia = original;
      } else {
        delete (window as { matchMedia?: typeof window.matchMedia }).matchMedia;
      }
    },
  };
}

/**
 * Scoped wrapper around `installReducedMotionMock`: runs `body` with the
 * mock in place, always restores afterwards (even if `body` throws).
 *
 * @example
 *   await withReducedMotion(true, async ({ mediaQuery }) => {
 *     const { result } = renderHook(() => useReducedMotion());
 *     expect(result.current).toBe(true);
 *     act(() => mediaQuery.dispatch(false));
 *     expect(result.current).toBe(false);
 *   });
 */
export async function withReducedMotion<T>(
  initialMatches: boolean,
  body: (ctx: { mediaQuery: FakeMediaQueryList }) => T | Promise<T>
): Promise<T> {
  const handle = installReducedMotionMock(initialMatches);
  try {
    return await body({ mediaQuery: handle.mediaQuery });
  } finally {
    handle.restore();
  }
}

/**
 * Synchronously dispatches a `transitionend` event on `element`, wrapped
 * in `act(...)` so React effects that depend on it flush before the next
 * assertion. Use this to drive drawer / dialog state machines that wait
 * on CSS transition completion.
 *
 * @param element - the node emitting the event (usually the animated wrapper).
 * @param propertyName - the CSS property the caller's listener filters on
 *   (e.g. `'transform'`). Defaults to `'transform'` since that is the
 *   most common animated property in this codebase.
 */
export function flushTransition(
  element: Element,
  propertyName: string = 'transform'
): void {
  act(() => {
    const event = new Event('transitionend', { bubbles: true });
    Object.defineProperty(event, 'propertyName', { value: propertyName });
    element.dispatchEvent(event);
  });
}
