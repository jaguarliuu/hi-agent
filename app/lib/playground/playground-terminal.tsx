'use client';

import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import {
  ensureInteractiveShell,
  ensureManifestInteractiveShell,
  teardownInteractiveShell,
  type InteractiveShellHandle
} from './webcontainer-manager';
import type { PlaygroundManifest } from './manifest-schema';
import { usePlaygroundTheme, type PlaygroundTheme } from './use-playground-theme';

const XTERM_THEMES: Record<PlaygroundTheme, {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
}> = {
  dark: {
    background: '#12141a',
    foreground: '#d9def7',
    cursor: '#d9def7',
    cursorAccent: '#12141a',
    selectionBackground: 'rgba(120, 140, 210, 0.35)'
  },
  light: {
    background: '#f7f8fa',
    foreground: '#1f2328',
    cursor: '#1f2328',
    cursorAccent: '#f7f8fa',
    selectionBackground: 'rgba(70, 105, 210, 0.22)'
  }
};

export interface PlaygroundTerminalHandle {
  writeCommand: (commandLine: string) => Promise<void>;
  focus: () => void;
}

interface PlaygroundTerminalProps {
  manifest: PlaygroundManifest | null;
  sectionId: string | null;
  status: string;
  handleRef?: React.MutableRefObject<PlaygroundTerminalHandle | null>;
}

export function PlaygroundTerminal({
  manifest,
  sectionId,
  status,
  handleRef
}: PlaygroundTerminalProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const shellRef = useRef<InteractiveShellHandle | null>(null);
  const dataDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const outputReaderRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [interactiveError, setInteractiveError] = useState<string | null>(null);
  const theme = usePlaygroundTheme();
  const themeRef = useRef<PlaygroundTheme>(theme);
  themeRef.current = theme;

  useImperativeHandle(
    handleRef ?? { current: null },
    () => ({
      async writeCommand(commandLine: string) {
        const shell = shellRef.current;
        if (!shell) return;
        await shell.input.write(`${commandLine}\n`);
      },
      focus() {
        xtermRef.current?.focus();
      }
    }),
    []
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const term = new Terminal({
      fontFamily:
        '"JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace',
      fontSize: 12,
      lineHeight: 1.3,
      cursorBlink: true,
      convertEol: true,
      theme: XTERM_THEMES[themeRef.current],
      allowProposedApi: true
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);

    xtermRef.current = term;
    fitAddonRef.current = fit;

    const runFit = () => {
      try {
        fit.fit();
      } catch {}
    };
    runFit();

    const observer = new ResizeObserver(() => {
      runFit();
      const shell = shellRef.current;
      if (shell) {
        shell.resize(term.cols, term.rows);
      }
    });
    observer.observe(host);
    resizeObserverRef.current = observer;

    return () => {
      observer.disconnect();
      resizeObserverRef.current = null;
      dataDisposableRef.current?.dispose();
      dataDisposableRef.current = null;
      try {
        outputReaderRef.current?.cancel();
      } catch {}
      outputReaderRef.current = null;
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!sectionId) return;
    if (status === 'booting' || status === 'loading' || status === 'unsupported') {
      return;
    }

    let cancelled = false;

    (async () => {
      const term = xtermRef.current;
      if (!term) return;

      const shell = manifest
        ? await ensureManifestInteractiveShell(manifest)
        : await ensureInteractiveShell(sectionId);
      if (cancelled) return;

      shellRef.current = shell;
      shell.resize(term.cols, term.rows);

      dataDisposableRef.current?.dispose();
      dataDisposableRef.current = term.onData(async (data) => {
        try {
          await shell.input.write(data);
          setInteractiveError(null);
        } catch {
          setInteractiveError('Terminal input failed. Restart the playground and try again.');
        }
      });

      try {
        outputReaderRef.current?.cancel();
      } catch {}

      const reader = shell.output.getReader();
      outputReaderRef.current = reader;

      (async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done || cancelled) break;
            if (value) {
              term.write(value);
            }
          }
        } catch {
          if (!cancelled) {
            setInteractiveError(
              'Terminal output failed. Restart the playground and try again.'
            );
          }
        }
      })();
    })();

    return () => {
      cancelled = true;
      dataDisposableRef.current?.dispose();
      dataDisposableRef.current = null;
      try {
        outputReaderRef.current?.cancel();
      } catch {}
      outputReaderRef.current = null;
      shellRef.current = null;
    };
  }, [manifest, sectionId, status]);

  useEffect(() => {
    return () => {
      void teardownInteractiveShell();
    };
  }, []);

  useEffect(() => {
    const term = xtermRef.current;
    if (!term) return;
    term.options.theme = XTERM_THEMES[theme];
  }, [theme]);

  return (
    <section className="ha-playground-output-shell" aria-label="Terminal">
      <header className="ha-playground-output-header">
        <div className="ha-playground-output-title">
          <span
            className={`ha-playground-output-dot status-${status}`}
            aria-hidden="true"
          />
          <span>终端</span>
        </div>
        <span className="ha-playground-output-context">~/workspace · jsh</span>
      </header>
      <div
        ref={hostRef}
        className="ha-playground-terminal-host"
        onClick={() => xtermRef.current?.focus()}
      />
      {interactiveError ? (
        <p className="ha-playground-terminal-error" role="alert">
          {interactiveError}
        </p>
      ) : null}
    </section>
  );
}
