import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlaygroundDrawer } from '@/app/lib/playground/playground-drawer';
import {
  PlaygroundContext,
  type PlaygroundContextValue
} from '@/app/lib/playground/playground-provider';
import type { PlaygroundManifest } from '@/app/lib/playground/manifest-schema';

vi.mock('@monaco-editor/react', () => ({
  default: function MockMonacoEditor({
    value
  }: {
    value?: string;
  }) {
    return <div data-testid="monaco-editor">{value}</div>;
  }
}));

const manifest: PlaygroundManifest = {
  id: 'labs-01-webcontainers-pilot',
  title: 'WebContainers 实验小节',
  snapshotId: 'labs-01-webcontainers-pilot-v1',
  snapshotUrl: '/webcontainer-snapshots/labs-01-webcontainers-pilot.bin',
  defaultOpenFile: 'src/main.ts',
  startup: {
    installCommands: [{ cmd: 'npm', args: ['install'] }],
    runCommands: [{ cmd: 'npm', args: ['run', 'chat'] }],
    env: ['OPENAI_API_KEY']
  },
  blocks: [
    {
      blockId: 'run-demo',
      type: 'command',
      label: '运行 Demo',
      command: { cmd: 'npm', args: ['run', 'chat'] }
    }
  ]
};

function createContextValue(): PlaygroundContextValue {
  return {
    isOpen: true,
    manifest,
    state: {
      status: 'ready',
      sectionId: manifest.id,
      activeFile: 'src/main.ts',
      output: ['User: hi', 'Assistant: hello'],
      error: null
    },
    files: [
      {
        path: 'src/main.ts',
        content: "console.log('hello')"
      },
      {
        path: 'src/config.ts',
        content: 'export const config = {}'
      }
    ],
    activeFileContent: "console.log('hello')",
    openSection: vi.fn(),
    closeDrawer: vi.fn(),
    selectFile: vi.fn(),
    updateActiveFile: vi.fn()
  };
}

describe('PlaygroundDrawer', () => {
  it('renders the playground title, file tree, editor, and output panel', () => {
    render(
      <PlaygroundContext.Provider value={createContextValue()}>
        <PlaygroundDrawer />
      </PlaygroundContext.Provider>
    );

    expect(
      screen.getByRole('heading', { name: 'WebContainers 实验小节' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'src/main.ts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'src/config.ts' })).toBeInTheDocument();
    expect(screen.getByTestId('monaco-editor')).toHaveTextContent(
      "console.log('hello')"
    );
    expect(screen.getByText('User: hi')).toBeInTheDocument();
    expect(screen.getByText('Assistant: hello')).toBeInTheDocument();
  });
});
