'use client';

import { useEffect } from 'react';
import { useToast } from '../motion/toast-context';

const REFRESH_NOTICE_KEY = 'ha-pwa-refresh-pending';

declare global {
  interface ServiceWorkerRegistration {
    readonly waiting: ServiceWorker | null;
  }
}

function isProductionRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  if (process.env.NODE_ENV !== 'production') return false;
  // Disable on http://localhost:* to keep `next start` debugging painless.
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
    return false;
  }
  return true;
}

function resolveSwUrl(): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
  return `${base}/sw.js`;
}

function resolveScope(): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
  return base ? `${base}/` : '/';
}

export function RegisterSW() {
  const { showToast } = useToast();

  useEffect(() => {
    if (!isProductionRuntime()) return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    let cancelled = false;
    let registration: ServiceWorkerRegistration | null = null;

    const promptRefresh = (waiting: ServiceWorker | null) => {
      if (cancelled || !waiting) return;
      try {
        sessionStorage.setItem(REFRESH_NOTICE_KEY, '1');
      } catch (_e) {
        /* storage may be disabled */
      }
      showToast('Hi-Agent 已更新，刷新页面即可使用新版本', {
        tone: 'info',
        durationMs: 6000
      });
      waiting.postMessage({ type: 'SKIP_WAITING' });
    };

    const onUpdateFound = () => {
      const installing = registration?.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (
          installing.state === 'installed' &&
          navigator.serviceWorker.controller
        ) {
          promptRefresh(registration?.waiting ?? installing);
        }
      });
    };

    const onControllerChange = () => {
      let pending = false;
      try {
        pending = sessionStorage.getItem(REFRESH_NOTICE_KEY) === '1';
        sessionStorage.removeItem(REFRESH_NOTICE_KEY);
      } catch (_e) {
        pending = false;
      }
      if (!pending) return;
      // Soft reload so users land on the new bundle without losing
      // their scroll position more than once.
      window.location.reload();
    };

    navigator.serviceWorker
      .register(resolveSwUrl(), { scope: resolveScope() })
      .then((reg) => {
        if (cancelled) return;
        registration = reg;
        if (reg.waiting && navigator.serviceWorker.controller) {
          promptRefresh(reg.waiting);
        }
        reg.addEventListener('updatefound', onUpdateFound);
      })
      .catch((err) => {
        if (typeof console !== 'undefined') {
          console.warn('[hi-agent] Service Worker registration failed', err);
        }
      });

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        onControllerChange
      );
    };
  }, [showToast]);

  return null;
}

export default RegisterSW;
