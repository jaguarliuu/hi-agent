import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MotionProvider } from '@/app/lib/motion/motion-context';
import { ThemeTransitionToggle } from '@/app/lib/motion/theme-transition-toggle';

const setThemeMock = vi.fn();
let resolvedTheme: string | undefined = 'light';

vi.mock('next-themes', () => ({
  useTheme: () => ({
    resolvedTheme,
    setTheme: setThemeMock,
    theme: resolvedTheme,
  }),
}));

beforeEach(() => {
  setThemeMock.mockReset();
  resolvedTheme = 'light';

  document.body.innerHTML = `
    <div class="nextra-navbar">
      <nav>
        <button class="nextra-hamburger">menu</button>
      </nav>
    </div>
  `;
});

afterEach(() => {
  document.body.innerHTML = '';
  // Clean up any startViewTransition stub a test left behind.
  delete (
    document as Document & { startViewTransition?: unknown }
  ).startViewTransition;
});

function renderToggle(reduced = false) {
  return render(
    <MotionProvider value={{ reduced, debug: false }}>
      <ThemeTransitionToggle />
    </MotionProvider>
  );
}

/**
 * Wait one animation frame, then flush any pending microtasks / React
 * effects. The toggle schedules its slot lookup via rAF and then flips
 * `mounted`/`slot` state, both of which need to settle before we
 * interact.
 */
async function waitForPortal() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  });
}

describe('<ThemeTransitionToggle>', () => {
  it('mounts into a slot inside the navbar', async () => {
    renderToggle();
    await waitForPortal();

    const toggle = screen.getByRole('button', { name: /切换/ });
    expect(toggle).toBeTruthy();
    expect(toggle.closest('.ha-theme-slot')).toBeTruthy();
    expect(toggle.closest('.nextra-navbar')).toBeTruthy();
  });

  it('falls back to a direct setTheme call when View Transitions API is missing', async () => {
    renderToggle();
    await waitForPortal();

    const toggle = screen.getByRole('button', { name: /切换/ });
    fireEvent.click(toggle);

    expect(setThemeMock).toHaveBeenCalledTimes(1);
    expect(setThemeMock).toHaveBeenCalledWith('dark');
  });

  it('skips the circular sweep when prefers-reduced-motion is on', async () => {
    const startViewTransition = vi.fn();
    (
      document as Document & {
        startViewTransition?: typeof startViewTransition;
      }
    ).startViewTransition = startViewTransition;

    renderToggle(true);
    await waitForPortal();

    const toggle = screen.getByRole('button', { name: /切换/ });
    fireEvent.click(toggle);

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(setThemeMock).toHaveBeenCalledWith('dark');
  });

  it('drives startViewTransition when supported and motion is allowed', async () => {
    const startViewTransition = vi.fn().mockImplementation((cb: () => void) => {
      cb();
      return {
        ready: Promise.resolve(),
        finished: Promise.resolve(),
      };
    });
    (
      document as Document & {
        startViewTransition?: typeof startViewTransition;
      }
    ).startViewTransition = startViewTransition;

    // jsdom does not implement Web Animations, so HTMLElement#animate
    // is undefined. Assign a stub directly rather than spying.
    const animateMock = vi
      .fn()
      .mockReturnValue({ finished: Promise.resolve() });
    const originalAnimate = (
      HTMLElement.prototype as HTMLElement & {
        animate?: unknown;
      }
    ).animate;
    (
      HTMLElement.prototype as HTMLElement & {
        animate?: unknown;
      }
    ).animate = animateMock;

    try {
      renderToggle(false);
      await waitForPortal();

      const toggle = screen.getByRole('button', { name: /切换/ });
      fireEvent.click(toggle);

      expect(startViewTransition).toHaveBeenCalledTimes(1);
      expect(setThemeMock).toHaveBeenCalledWith('dark');

      // Let the .ready microtask resolve so the animate() call fires.
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(animateMock).toHaveBeenCalled();
    } finally {
      if (originalAnimate === undefined) {
        delete (
          HTMLElement.prototype as HTMLElement & {
            animate?: unknown;
          }
        ).animate;
      } else {
        (
          HTMLElement.prototype as HTMLElement & {
            animate?: unknown;
          }
        ).animate = originalAnimate;
      }
    }
  });

  it('holds the last frame when shrinking the old dark snapshot during dark-to-light transitions', async () => {
    resolvedTheme = 'dark';

    const startViewTransition = vi.fn().mockImplementation((cb: () => void) => {
      cb();
      return {
        ready: Promise.resolve(),
        finished: Promise.resolve(),
      };
    });
    (
      document as Document & {
        startViewTransition?: typeof startViewTransition;
      }
    ).startViewTransition = startViewTransition;

    const animateMock = vi
      .fn()
      .mockReturnValue({ finished: Promise.resolve() });
    const originalAnimate = (
      HTMLElement.prototype as HTMLElement & {
        animate?: unknown;
      }
    ).animate;
    (
      HTMLElement.prototype as HTMLElement & {
        animate?: unknown;
      }
    ).animate = animateMock;

    try {
      renderToggle(false);
      await waitForPortal();

      const toggle = screen.getByRole('button', { name: '切换到浅色主题' });
      fireEvent.click(toggle);

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(setThemeMock).toHaveBeenCalledWith('light');
      expect(animateMock).toHaveBeenCalledTimes(1);
      expect(animateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          clipPath: expect.any(Array),
        }),
        expect.objectContaining({
          pseudoElement: '::view-transition-old(root)',
          fill: 'both',
        })
      );
    } finally {
      if (originalAnimate === undefined) {
        delete (
          HTMLElement.prototype as HTMLElement & {
            animate?: unknown;
          }
        ).animate;
      } else {
        (
          HTMLElement.prototype as HTMLElement & {
            animate?: unknown;
          }
        ).animate = originalAnimate;
      }
    }
  });
});
