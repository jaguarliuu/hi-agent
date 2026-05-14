import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlaygroundTerminal } from '@/app/lib/playground/playground-terminal';
import type { PlaygroundManifest } from '@/app/lib/playground/manifest-schema';

const {
  ensureInteractiveShellMock,
  ensureManifestInteractiveShellMock,
  teardownInteractiveShellMock
} = vi.hoisted(() => ({
  ensureInteractiveShellMock: vi.fn(),
  ensureManifestInteractiveShellMock: vi.fn(),
  teardownInteractiveShellMock: vi.fn()
}));

let onDataHandler: ((data: string) => void | Promise<void>) | null = null;

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    cols: 80,
    rows: 24,
    loadAddon: vi.fn(),
    open: vi.fn(),
    focus: vi.fn(),
    write: vi.fn(),
    dispose: vi.fn(),
    onData: vi.fn((handler) => {
      onDataHandler = handler;
      return { dispose: vi.fn() };
    }),
    options: {}
  }))
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: vi.fn()
  }))
}));

vi.mock('@xterm/xterm/css/xterm.css', () => ({}));

vi.mock('@/app/lib/playground/webcontainer-manager', () => ({
  ensureInteractiveShell: ensureInteractiveShellMock,
  ensureManifestInteractiveShell: ensureManifestInteractiveShellMock,
  teardownInteractiveShell: teardownInteractiveShellMock
}));

class ResizeObserverMock {
  observe = vi.fn();
  disconnect = vi.fn();
}

const manifest: PlaygroundManifest = {
  id: 'labs-01-webcontainers-pilot',
  title: 'WebContainers Pilot',
  snapshotId: 'labs-01-webcontainers-pilot-v1',
  snapshotUrl: '/webcontainer-snapshots/labs-01-webcontainers-pilot.bin',
  defaultOpenFile: 'src/main.js',
  startup: {
    installCommands: [],
    runCommands: [{ cmd: 'npm', args: ['run', 'chat'] }],
    env: ['OPENAI_API_KEY']
  },
  blocks: [
    {
      blockId: 'run-demo',
      type: 'command',
      label: 'Run demo',
      command: { cmd: 'npm', args: ['run', 'chat'] }
    }
  ]
};

describe('PlaygroundTerminal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onDataHandler = null;
    global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
    ensureInteractiveShellMock.mockResolvedValue({
      input: {
        write: vi.fn().mockRejectedValue(new Error('input stream closed'))
      },
      output: new ReadableStream(),
      resize: vi.fn()
    });
    ensureManifestInteractiveShellMock.mockResolvedValue({
      input: {
        write: vi.fn().mockRejectedValue(new Error('input stream closed'))
      },
      output: new ReadableStream(),
      resize: vi.fn()
    });
    teardownInteractiveShellMock.mockResolvedValue(undefined);
  });

  it('surfaces interactive shell write failures to the user', async () => {
    render(
      <PlaygroundTerminal
        manifest={manifest}
        sectionId="labs-01-webcontainers-pilot"
        status="ready"
      />
    );

    await waitFor(() => {
      expect(onDataHandler).toBeTruthy();
    });

    await act(async () => {
      await onDataHandler?.('x');
    });

    expect(
      await screen.findByText('Terminal input failed. Restart the playground and try again.')
    ).toBeInTheDocument();
  });

  it('reuses the manifest-aware shell instead of replacing it with a shell without env', async () => {
    render(
      <PlaygroundTerminal
        manifest={manifest}
        sectionId="labs-01-webcontainers-pilot"
        status="ready"
      />
    );

    await waitFor(() => {
      expect(ensureManifestInteractiveShellMock).toHaveBeenCalledWith(manifest);
    });
    expect(ensureInteractiveShellMock).not.toHaveBeenCalled();
  });
});
