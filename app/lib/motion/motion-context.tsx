'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useMotionDebug } from './use-motion-debug';

/**
 * Shape of the global motion preferences shared across the site.
 *
 * Only contains preferences the user (or the OS) can express. Concrete
 * motion values (durations, easings) live as CSS custom properties in
 * `globals.css` and are consumed via `var(--ha-motion-*)` — there is no
 * reason to thread them through React state.
 */
export interface MotionContextValue {
  /**
   * Mirrors `prefers-reduced-motion: reduce`. Defaults to `false` on the
   * server and during the first client render to keep SSR/hydration
   * stable; the real value is applied after mount.
   */
  reduced: boolean;
  /**
   * `true` when the dev-only motion slowdown is active. Mostly informative
   * for components that want to render a debug badge; the visual scaling
   * is handled by CSS via the `<html data-motion-debug>` attribute.
   */
  debug: boolean;
}

const DEFAULT_VALUE: MotionContextValue = { reduced: false, debug: false };

const MotionContext = createContext<MotionContextValue>(DEFAULT_VALUE);

/**
 * Provides the shared motion-preference signal to every descendant.
 *
 * Why a Context instead of having every consumer call
 * `window.matchMedia(...)` directly?
 *
 *   1. One subscription to `(prefers-reduced-motion: reduce)` per page
 *      instead of one per component.
 *   2. Single place to layer in user-overridable preferences in the
 *      future (e.g. a "Reduce motion" toggle in site settings).
 *   3. Tests can wrap their subject in `<MotionProvider value={...}>`
 *      to drive any motion branch deterministically.
 *
 * The provider is a client component (mounted in the root layout via
 * `<MotionRuntime />`). On the server it renders only its children,
 * with the default `{ reduced: false, debug: false }` falling through.
 */
export function MotionProvider({
  children,
  /** Optional override, primarily for tests. */
  value,
}: {
  children: ReactNode;
  value?: Partial<MotionContextValue>;
}) {
  const [reduced, setReduced] = useState<boolean>(value?.reduced ?? false);
  const debug = useMotionDebug();

  useEffect(() => {
    if (value?.reduced !== undefined) return;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);

    const handleChange = (event: MediaQueryListEvent) => setReduced(event.matches);

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', handleChange);
      return () => query.removeEventListener('change', handleChange);
    }

    const legacyQuery = query as MediaQueryList & {
      addListener?: (cb: (event: MediaQueryListEvent) => void) => void;
      removeListener?: (cb: (event: MediaQueryListEvent) => void) => void;
    };
    legacyQuery.addListener?.(handleChange);
    return () => {
      legacyQuery.removeListener?.(handleChange);
    };
  }, [value?.reduced]);

  const merged = useMemo<MotionContextValue>(
    () => ({
      reduced: value?.reduced ?? reduced,
      debug: value?.debug ?? debug,
    }),
    [value?.reduced, value?.debug, reduced, debug]
  );

  return <MotionContext.Provider value={merged}>{children}</MotionContext.Provider>;
}

/**
 * Reads the full motion-preference snapshot.
 *
 * Outside any `<MotionProvider>` (e.g. in unit tests for a leaf component
 * that does not wrap itself), this returns the SSR-safe default
 * `{ reduced: false, debug: false }`.
 */
export function useMotion(): MotionContextValue {
  return useContext(MotionContext);
}
