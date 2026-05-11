'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useTheme } from 'next-themes';

import { useMotion } from './motion-context';

/**
 * Drop-in replacement for Nextra's three-state theme `<Listbox>`. We
 * own this UI deliberately because the View-Transitions–driven circular
 * sweep needs to wrap `setTheme` in a `flushSync` inside
 * `document.startViewTransition()`. There is no public hook in Nextra
 * 4 to inject behavior between the listbox option click and
 * next-themes' state update, so we render our own button.
 *
 * Trade-off: we drop the explicit "system" choice. Initial theme still
 * follows the OS via `next-themes`'s default; users who flip their OS
 * theme will see the site re-pick on next reload. If this becomes
 * insufficient we can add a long-press menu later.
 *
 * Algorithm credit: 远方os —
 *   https://juejin.cn/post/7361721559239524390
 *
 * Adaptations from the original recipe:
 *   - `flushSync` so `next-themes`'s React state actually commits
 *     before the View Transitions API takes its "new" snapshot.
 *   - Feature-detect `document.startViewTransition`; fall back to a
 *     direct `setTheme` (the global 240ms cross-fade we wired into
 *     `globals.css` then takes over).
 *   - Honor `prefers-reduced-motion`. Reduced motion skips the sweep
 *     completely; the user still gets the color change but no
 *     decorative animation.
 *   - Coordinate fallback when the click came from a keyboard
 *     (`event.detail === 0`): use the button's own bounding box as
 *     the origin, not `clientX/Y === 0`.
 */
export function ThemeTransitionToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { reduced } = useMotion();
  const [mounted, setMounted] = useState(false);
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const ATTACH_ATTR = 'data-ha-theme-slot';

    const findOrCreateSlot = (): HTMLElement | null => {
      const navbar = document.querySelector('.nextra-navbar nav');
      if (!navbar) return null;

      const existing = navbar.querySelector(`[${ATTACH_ATTR}]`);
      if (existing instanceof HTMLElement) return existing;

      const created = document.createElement('div');
      created.setAttribute(ATTACH_ATTR, '');
      created.className = 'ha-theme-slot';

      const hamburger = navbar.querySelector('.nextra-hamburger');
      if (hamburger) {
        navbar.insertBefore(created, hamburger);
      } else {
        navbar.appendChild(created);
      }
      return created;
    };

    let cancelled = false;
    let raf = 0;

    const ensureSlot = () => {
      if (cancelled) return;
      const found = findOrCreateSlot();
      if (found) {
        setSlot((prev) => (prev === found ? prev : found));
      } else {
        raf = window.requestAnimationFrame(ensureSlot);
      }
    };

    ensureSlot();

    // Nextra/Next.js can re-render the navbar on route changes. Watch
    // the body for navbar churn and re-attach when our slot vanishes.
    const observer = new MutationObserver(() => {
      if (cancelled) return;
      ensureSlot();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const next = isDark ? 'light' : 'dark';

      const supportsViewTransition =
        typeof document !== 'undefined' &&
        typeof (
          document as Document & {
            startViewTransition?: (cb: () => void) => unknown;
          }
        ).startViewTransition === 'function';

      if (!supportsViewTransition || reduced) {
        setTheme(next);
        return;
      }

      const button = event.currentTarget;
      const rect = button.getBoundingClientRect();
      const isKeyboard = event.detail === 0;
      const originX = isKeyboard
        ? rect.left + rect.width / 2
        : event.clientX;
      const originY = isKeyboard
        ? rect.top + rect.height / 2
        : event.clientY;

      const transition = (
        document as Document & {
          startViewTransition: (cb: () => void) => {
            ready: Promise<void>;
            finished: Promise<void>;
          };
        }
      ).startViewTransition(() => {
        flushSync(() => setTheme(next));
      });

      void transition.ready
        .then(() => {
          const radius = Math.hypot(
            Math.max(originX, window.innerWidth - originX),
            Math.max(originY, window.innerHeight - originY)
          );

          const expand = [
            `circle(0px at ${originX}px ${originY}px)`,
            `circle(${radius}px at ${originX}px ${originY}px)`,
          ];

          // Going dark: the new (dark) screenshot fills in. Expand it.
          // Going light: keep the old (dark) screenshot on top and
          //              shrink it, revealing the light surface beneath.
          const goingDark = next === 'dark';
          const clipPath = goingDark ? expand : [...expand].reverse();
          const pseudoElement = goingDark
            ? '::view-transition-new(root)'
            : '::view-transition-old(root)';

          document.documentElement.animate(
            { clipPath },
            {
              duration: 480,
              easing: 'cubic-bezier(0.2, 0, 0, 1)',
              pseudoElement,
            }
          );
        })
        .catch(() => {
          // The View Transitions API rejects `.ready` if the browser
          // skips the animation (e.g. tab hidden mid-flight). The
          // theme has already changed via flushSync, so swallowing is
          // safe.
        });
    },
    [isDark, reduced, setTheme]
  );

  // SSR / first paint: render a stable shell so hydration matches.
  // We avoid showing a different icon until `mounted` flips so the
  // server-rendered DOM doesn't disagree with the client.
  const label = mounted ? (isDark ? '切换到浅色主题' : '切换到深色主题') : '切换主题';

  if (!slot) return null;

  return createPortal(
    <button
      type="button"
      data-ha-theme-toggle=""
      data-theme-resolved={mounted ? (isDark ? 'dark' : 'light') : 'unknown'}
      aria-label={label}
      title={label}
      onClick={handleClick}
    >
      <SunIcon />
      <MoonIcon />
    </button>,
    slot
  );
}

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="ha-theme-toggle-icon ha-theme-toggle-icon-sun"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="ha-theme-toggle-icon ha-theme-toggle-icon-moon"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
    </svg>
  );
}
