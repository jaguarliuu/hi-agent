'use client';

import { useEffect } from 'react';
import { prebootWebcontainer, prefetchSnapshot } from './webcontainer-manager';

interface PlaygroundPrewarmProps {
  snapshotUrl?: string;
}

export function PlaygroundPrewarm({ snapshotUrl }: PlaygroundPrewarmProps) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;
    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;

    const runPrewarm = () => {
      if (cancelled) return;
      void prebootWebcontainer();
      if (snapshotUrl) {
        void prefetchSnapshot(snapshotUrl);
      }
    };

    const ric = (
      window as typeof window & {
        requestIdleCallback?: (
          cb: IdleRequestCallback,
          opts?: IdleRequestOptions
        ) => number;
        cancelIdleCallback?: (handle: number) => void;
      }
    ).requestIdleCallback;

    if (typeof ric === 'function') {
      idleHandle = ric(runPrewarm, { timeout: 2000 });
    } else {
      timeoutHandle = window.setTimeout(runPrewarm, 600);
    }

    return () => {
      cancelled = true;
      const cic = (
        window as typeof window & {
          cancelIdleCallback?: (handle: number) => void;
        }
      ).cancelIdleCallback;
      if (idleHandle !== null && typeof cic === 'function') {
        cic(idleHandle);
      }
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, [snapshotUrl]);

  return null;
}
