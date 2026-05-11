'use client';

import { useEffect, useState } from 'react';

/**
 * Returns whether the user has requested reduced motion at the OS level.
 *
 * Contract (see specs/2026-05-11-site-motion-design.md § P4):
 *   - Default to `false` so SSR and the very first client render agree
 *     (avoids hydration mismatch).
 *   - Subscribe to `matchMedia` change events so a mid-session toggle
 *     in the OS is reflected without a reload.
 *   - Safe under environments without `window.matchMedia` (returns false).
 *
 * Components that opt into JS-driven motion should read this hook and
 * either skip the animation or shorten it to its end-state. CSS-driven
 * motion does not need this hook because the global media-query block
 * in globals.css already neutralizes durations.
 *
 * Relationship to `useMotion()` (`./motion-context.tsx`):
 *   - `useMotion()` is the preferred reader inside the `<MotionProvider>`
 *     tree. It exposes both `reduced` and `debug` and reuses a single
 *     matchMedia subscription across the whole site.
 *   - `useReducedMotion()` stays as a dependency-free escape hatch for
 *     leaf components / tests that intentionally do not want to depend
 *     on the Context. The two implementations are kept behaviorally
 *     equivalent for the `reduced` signal.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');

    setReduced(query.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setReduced(event.matches);
    };

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', handleChange);
      return () => query.removeEventListener('change', handleChange);
    }

    // Safari < 14 fallback — addListener / removeListener.
    const legacyQuery = query as MediaQueryList & {
      addListener?: (cb: (event: MediaQueryListEvent) => void) => void;
      removeListener?: (cb: (event: MediaQueryListEvent) => void) => void;
    };
    legacyQuery.addListener?.(handleChange);
    return () => legacyQuery.removeListener?.(handleChange);
  }, []);

  return reduced;
}
