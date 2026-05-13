'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastOptions {
  tone?: ToastTone;
  durationMs?: number;
}

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions) => void;
}

const DEFAULT_DURATION_MS = 1800;

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timersRef = useRef<Map<number, number>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback<ToastContextValue['showToast']>(
    (message, options) => {
      const id = ++idRef.current;
      const tone: ToastTone = options?.tone ?? 'info';
      const duration = options?.durationMs ?? DEFAULT_DURATION_MS;

      setToasts((current) => [...current, { id, message, tone }]);

      if (typeof window !== 'undefined') {
        const timer = window.setTimeout(() => {
          dismiss(id);
        }, duration);
        timersRef.current.set(id, timer);
      }
    },
    [dismiss]
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="ha-toast-stack"
        data-empty={toasts.length === 0 ? 'true' : 'false'}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            data-tone={toast.tone}
            className="ha-toast"
          >
            <span className="ha-toast-message">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: () => {
        if (typeof console !== 'undefined') {
          console.warn(
            'useToast() called outside of <ToastProvider>; toast suppressed.'
          );
        }
      },
    };
  }
  return ctx;
}
