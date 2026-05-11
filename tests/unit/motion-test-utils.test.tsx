import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import {
  createFakeMediaQueryList,
  flushTransition,
  installReducedMotionMock,
  withReducedMotion,
  type ReducedMotionMock,
} from '../helpers/motion-test-utils';
import {
  MotionProvider,
  useMotion,
} from '@/app/lib/motion/motion-context';

describe('motion-test-utils', () => {
  describe('createFakeMediaQueryList', () => {
    it('dispatches change events to every registered listener', () => {
      const fake = createFakeMediaQueryList(false);
      const received: boolean[] = [];
      fake.addEventListener('change', (event) => received.push(event.matches));
      fake.dispatch(true);
      fake.dispatch(false);
      expect(received).toEqual([true, false]);
      expect(fake.matches).toBe(false);
    });

    it('removes listeners via removeEventListener', () => {
      const fake = createFakeMediaQueryList(false);
      const listener = () => {};
      fake.addEventListener('change', listener);
      expect(fake.listeners.size).toBe(1);
      fake.removeEventListener('change', listener);
      expect(fake.listeners.size).toBe(0);
    });
  });

  describe('installReducedMotionMock / withReducedMotion', () => {
    let mock: ReducedMotionMock | undefined;

    afterEach(() => {
      mock?.restore();
      mock = undefined;
    });

    it('routes window.matchMedia through the supplied fake', () => {
      mock = installReducedMotionMock(true);
      const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      expect(mql).toBe(mock.mediaQuery);
      expect(mql.matches).toBe(true);
    });

    it('restores the original matchMedia on teardown', () => {
      const sentinel = (() => ({ matches: false })) as unknown as typeof window.matchMedia;
      window.matchMedia = sentinel;
      const handle = installReducedMotionMock(false);
      expect(window.matchMedia).not.toBe(sentinel);
      handle.restore();
      expect(window.matchMedia).toBe(sentinel);
    });

    it('withReducedMotion cleans up even when the body throws', async () => {
      const sentinel = (() => ({ matches: false })) as unknown as typeof window.matchMedia;
      window.matchMedia = sentinel;
      await expect(
        withReducedMotion(true, () => {
          throw new Error('boom');
        })
      ).rejects.toThrow('boom');
      expect(window.matchMedia).toBe(sentinel);
    });
  });

  describe('flushTransition', () => {
    let mock: ReducedMotionMock;
    beforeEach(() => {
      mock = installReducedMotionMock(false);
    });
    afterEach(() => {
      mock.restore();
    });

    it('dispatches a bubbling transitionend with the given propertyName', () => {
      const received: Array<{ bubbles: boolean; prop: string }> = [];
      const el = document.createElement('div');
      document.body.appendChild(el);
      el.addEventListener('transitionend', (event) => {
        received.push({
          bubbles: event.bubbles,
          prop: (event as TransitionEvent).propertyName,
        });
      });

      flushTransition(el, 'opacity');

      expect(received).toEqual([{ bubbles: true, prop: 'opacity' }]);
      document.body.removeChild(el);
    });
  });

  describe('MotionProvider integration', () => {
    let mock: ReducedMotionMock;
    beforeEach(() => {
      mock = installReducedMotionMock(false);
    });
    afterEach(() => {
      mock.restore();
    });

    it('subscribes once and propagates reduced-motion to all consumers', () => {
      function Probe() {
        const { reduced } = useMotion();
        return <span data-testid="probe">{reduced ? 'reduced' : 'full'}</span>;
      }

      const { getAllByTestId } = render(
        <MotionProvider>
          <Probe />
          <Probe />
          <Probe />
        </MotionProvider>
      );

      expect(getAllByTestId('probe').map((n) => n.textContent)).toEqual([
        'full',
        'full',
        'full',
      ]);
      expect(mock.mediaQuery.listeners.size).toBe(1);

      act(() => {
        mock.mediaQuery.dispatch(true);
      });

      expect(getAllByTestId('probe').map((n) => n.textContent)).toEqual([
        'reduced',
        'reduced',
        'reduced',
      ]);
    });

    it('respects an explicit value override (useful for tests)', () => {
      function Probe() {
        const { reduced } = useMotion();
        return <span data-testid="probe">{reduced ? 'reduced' : 'full'}</span>;
      }

      const { getByTestId } = render(
        <MotionProvider value={{ reduced: true }}>
          <Probe />
        </MotionProvider>
      );

      expect(getByTestId('probe').textContent).toBe('reduced');
    });

    it('returns SSR-safe defaults when consumed outside the Provider', () => {
      const { result } = renderHook(() => useMotion());
      expect(result.current).toEqual({ reduced: false, debug: false });
    });
  });
});
