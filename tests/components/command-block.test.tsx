import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommandBlock } from '@/app/lib/command-block';
import { PlaygroundSection } from '@/app/lib/playground/playground-section';
import {
  PlaygroundContext,
  type PlaygroundContextValue
} from '@/app/lib/playground/playground-provider';
import type { PlaygroundManifest } from '@/app/lib/playground/manifest-schema';

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
      blockId: 'install-deps',
      type: 'command',
      label: '安装依赖',
      command: { cmd: 'npm', args: ['install'] }
    }
  ]
};

function createContextValue(): PlaygroundContextValue {
  return {
    isOpen: false,
    manifest,
    state: {
      status: 'idle',
      sectionId: null,
      activeFile: null,
      output: [],
      error: null
    },
    files: [],
    activeFileContent: '',
    activeFileAnchor: null,
    openProject: vi.fn(),
    runCommand: vi.fn().mockResolvedValue(undefined),
    openFile: vi.fn(),
    closeDrawer: vi.fn(),
    selectFile: vi.fn(),
    updateActiveFile: vi.fn()
  };
}
describe('CommandBlock', () => {
  it('renders a run action that boots the playground command for the current section', () => {
    const contextValue = createContextValue();

    render(
      <PlaygroundContext.Provider value={contextValue}>
        <PlaygroundSection sectionId={manifest.id}>
          <CommandBlock blockId="install-deps">
            <pre data-testid="themed-pre" data-language="bash">
              <code>npm install</code>
            </pre>
          </CommandBlock>
        </PlaygroundSection>
      </PlaygroundContext.Provider>
    );

    expect(screen.getByRole('button', { name: '运行' })).toBeInTheDocument();
    expect(screen.getByTestId('themed-pre')).toHaveTextContent('npm install');

    fireEvent.click(screen.getByRole('button', { name: '运行' }));

    expect(contextValue.runCommand).toHaveBeenCalledWith(
      manifest.id,
      'install-deps'
    );
  });
});
