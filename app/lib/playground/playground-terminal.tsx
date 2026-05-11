'use client';

import React, { useEffect, useImperativeHandle, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import {
  ensureInteractiveShell,
  teardownInteractiveShell,
  type InteractiveShellHandle
} from './webcontainer-manager';

export interface PlaygroundTerminalHandle {
  writeCommand: (commandLine: string) => Promise<void>;
  focus: () => void;
}

interface PlaygroundTerminalProps {
  sectionId: string | null;
  status: string;
  handleRef?: React.MutableRefObject<PlaygroundTerminalHandle | null>;
}

export function PlaygroundTerminal({
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
      theme: {
        background: '#12141a',
        foreground: '#d9def7',
        cursor: '#d9def7',
        cursorAccent: '#12141a',
        selectionBackground: 'rgba(120, 140, 210, 0.35)'
      },
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

      const shell = await ensureInteractiveShell(sectionId);
      if (cancelled) return;

      shellRef.current = shell;
      shell.resize(term.cols, term.rows);

      dataDisposableRef.current?.dispose();
      dataDisposableRef.current = term.onData(async (data) => {
        try {
          await shell.input.write(data);
        } catch {}
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
        } catch {}
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
  }, [sectionId, status]);

  useEffect(() => {
    return () => {
      void teardownInteractiveShell();
    };
  }, []);

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
    </section>
  );
}
