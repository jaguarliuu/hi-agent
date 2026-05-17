'use client';

import { useCallback, useEffect, useState } from 'react';

const VISIT_COUNT_KEY = 'ha-pwa-visit-count';
const DISMISS_KEY = 'ha-pwa-install-dismissed';
const ACCEPTED_KEY = 'ha-pwa-installed';
const VISIT_THRESHOLD = 3;

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: ReadonlyArray<string>;
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function safeRead(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (_err) {
    return null;
  }
}

function safeWrite(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (_err) {
    /* storage may be disabled */
  }
}

function bumpVisitCount(): number {
  const current = Number(safeRead(VISIT_COUNT_KEY) ?? '0') || 0;
  const next = current + 1;
  safeWrite(VISIT_COUNT_KEY, String(next));
  return next;
}

export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (safeRead(ACCEPTED_KEY) === '1' || safeRead(DISMISS_KEY) === '1') {
      return;
    }
    const visits = bumpVisitCount();

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      const evt = e as BeforeInstallPromptEvent;
      setEvent(evt);
      if (visits >= VISIT_THRESHOLD) {
        setVisible(true);
      }
    };
    const onInstalled = () => {
      safeWrite(ACCEPTED_KEY, '1');
      setVisible(false);
      setEvent(null);
    };

    window.addEventListener(
      'beforeinstallprompt',
      onBeforeInstall as EventListener
    );
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        onBeforeInstall as EventListener
      );
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = useCallback((persist: boolean) => {
    setVisible(false);
    if (persist) safeWrite(DISMISS_KEY, '1');
  }, []);

  const accept = useCallback(async () => {
    if (!event) return;
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === 'accepted') {
        safeWrite(ACCEPTED_KEY, '1');
      } else {
        safeWrite(DISMISS_KEY, '1');
      }
    } catch (_err) {
      /* user cancelled */
    } finally {
      setVisible(false);
      setEvent(null);
    }
  }, [event]);

  if (!visible || !event) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="ha-install-title"
      aria-describedby="ha-install-desc"
      className="ha-install-prompt"
      data-testid="ha-install-prompt"
    >
      <div className="ha-install-prompt-body">
        <strong id="ha-install-title" className="ha-install-prompt-title">
          把 Hi-Agent 添加到主屏幕？
        </strong>
        <p id="ha-install-desc" className="ha-install-prompt-desc">
          安装为应用后可离线阅读已读章节，并在桌面/主屏快速进入课程。
        </p>
      </div>
      <div className="ha-install-prompt-actions">
        <button
          type="button"
          className="ha-install-prompt-btn ha-install-prompt-btn-ghost"
          onClick={() => dismiss(true)}
        >
          以后再说
        </button>
        <button
          type="button"
          className="ha-install-prompt-btn ha-install-prompt-btn-primary"
          onClick={accept}
        >
          安装
        </button>
      </div>
    </div>
  );
}

export default InstallPrompt;
