'use client';

import { useEffect, useState } from 'react';

/**
 * Dev-only motion slowdown hook.
 *
 * Activates a 4× duration multiplier on the global motion token block when
 * either of the following is true:
 *
 * 1. The current URL has `?motion-debug=1` (or any truthy value).
 * 2. `localStorage.getItem('HA_MOTION_DEBUG') === '1'`.
 *
 * Toggling either input flips a `data-motion-debug="slow"` attribute on
 * `<html>`, which a paired CSS rule in `globals.css` reads to scale every
 * `--ha-motion-duration-*` token. No component code needs to change.
 *
 * The hook is SSR-safe (returns `false` until mount), idempotent across
 * remounts, and self-cleans the DOM attribute when the consumer unmounts.
 *
 * Why a query string AND localStorage?
 *  - Query string is shareable in a Slack thread to demo a slowed-down view.
 *  - localStorage persists across navigations during a debugging session
 *    without polluting every URL.
 *
 * Source of truth: docs/superpowers/specs/2026-05-11-site-motion-design.md
 */
export function useMotionDebug(): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const compute = (): boolean => {
      try {
        if (
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ) {
          return false;
        }
      } catch {
        // matchMedia may throw under odd embeds; treat as not-reduced.
      }
      try {
        const params = new URLSearchParams(window.location.search);
        const fromUrl = params.get('motion-debug');
        if (fromUrl && fromUrl !== '0' && fromUrl !== 'false') return true;
      } catch {
        // location.search may be unavailable in odd embeds; ignore.
      }
      try {
        if (window.localStorage.getItem('HA_MOTION_DEBUG') === '1') return true;
      } catch {
        // Private mode / storage disabled.
      }
      return false;
    };

    const apply = () => {
      const next = compute();
      setActive(next);
      const root = document.documentElement;
      if (next) {
        root.setAttribute('data-motion-debug', 'slow');
      } else {
        root.removeAttribute('data-motion-debug');
      }
    };

    apply();

    const onStorage = (event: StorageEvent) => {
      if (event.key === 'HA_MOTION_DEBUG' || event.key === null) apply();
    };
    const onPopState = () => apply();

    window.addEventListener('storage', onStorage);
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('popstate', onPopState);
      document.documentElement.removeAttribute('data-motion-debug');
    };
  }, []);

  return active;
}
