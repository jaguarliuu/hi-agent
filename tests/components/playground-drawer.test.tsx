import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlaygroundDrawer } from '@/app/lib/playground/playground-drawer';
import {
  PlaygroundContext,
  PlaygroundProvider,
  usePlayground,
  type PlaygroundContextValue
} from '@/app/lib/playground/playground-provider';
import type { PlaygroundManifest } from '@/app/lib/playground/manifest-schema';

const {
  getPlaygroundManifestMock,
  getWebcontainerMock,
  listWorkspaceFilesMock,
  prepareSectionWorkspaceMock,
  readWorkspaceFileMock,
  runManifestCommandMock,
  writeWorkspaceFileMock
} = vi.hoisted(() => ({
  getPlaygroundManifestMock: vi.fn(),
  getWebcontainerMock: vi.fn(),
  listWorkspaceFilesMock: vi.fn(),
  prepareSectionWorkspaceMock: vi.fn(),
  readWorkspaceFileMock: vi.fn(),
  runManifestCommandMock: vi.fn(),
  writeWorkspaceFileMock: vi.fn()
}));

vi.mock('@monaco-editor/react', () => ({
  default: function MockMonacoEditor({
    value
  }: {
    value?: string;
  }) {
    return <div data-testid="monaco-editor">{value}</div>;
  }
}));

vi.mock('@/app/lib/playground/manifest-loader', () => ({
  getPlaygroundManifest: getPlaygroundManifestMock
}));

vi.mock('@/app/lib/playground/webcontainer-manager', () => ({
  getWebcontainer: getWebcontainerMock,
  listWorkspaceFiles: listWorkspaceFilesMock,
  prepareSectionWorkspace: prepareSectionWorkspaceMock,
  readWorkspaceFile: readWorkspaceFileMock,
  runManifestCommand: runManifestCommandMock,
  writeWorkspaceFile: writeWorkspaceFileMock
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

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

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
        path: 'src/main.ts'
      },
      {
        path: 'src/config.ts'
      }
    ],
    activeFileContent: "console.log('hello')",
    openProject: vi.fn(),
    runCommand: vi.fn(),
    openFile: vi.fn(),
    closeDrawer: vi.fn(),
    selectFile: vi.fn(),
    updateActiveFile: vi.fn()
  };
}

function PlaygroundHarness() {
  const {
    closeDrawer,
    openProject,
    runCommand,
    files,
    activeFileContent,
    state
  } = usePlayground();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void openProject(manifest.id);
        }}
      >
        打开实验
      </button>
      <button
        type="button"
        onClick={() => {
          void runCommand(manifest.id, 'run-demo');
        }}
      >
        运行实验
      </button>
      <button type="button" onClick={closeDrawer}>
        关闭实验
      </button>
      <div data-testid="file-count">{files.length}</div>
      <div data-testid="active-file">{state.activeFile ?? ''}</div>
      <div data-testid="active-content">{activeFileContent}</div>
      <div data-testid="output">{state.output.join('|')}</div>
    </>
  );
}

describe('PlaygroundDrawer', () => {
  beforeEach(() => {
    getPlaygroundManifestMock.mockReturnValue(manifest);
    getWebcontainerMock.mockResolvedValue({});
    listWorkspaceFilesMock.mockResolvedValue(['src/main.ts', 'src/config.ts']);
    prepareSectionWorkspaceMock.mockResolvedValue(undefined);
    readWorkspaceFileMock.mockResolvedValue("console.log('hello')");
    runManifestCommandMock.mockImplementation(
      async (
        _manifest: PlaygroundManifest,
        _blockId: string,
        onChunk: (chunk: string) => void
      ) => {
        onChunk('User: hi');
        onChunk('Assistant: hello');
        return 0;
      }
    );
    writeWorkspaceFileMock.mockResolvedValue(undefined);
    Object.defineProperty(window, 'crossOriginIsolated', {
      value: true,
      configurable: true
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

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

  it('does not mount the drawer before the playground is opened', () => {
    render(
      <PlaygroundProvider>
        <PlaygroundHarness />
      </PlaygroundProvider>
    );

    expect(
      screen.queryByRole('heading', { name: 'WebContainers 实验小节' })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Runnable playground')).not.toBeInTheDocument();
    expect(screen.queryByTestId('monaco-editor')).not.toBeInTheDocument();
  });

  it('clears stale workspace state when reopening in an unsupported browser', async () => {
    render(
      <PlaygroundProvider>
        <PlaygroundHarness />
      </PlaygroundProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: '运行实验' }));

    await waitFor(() => {
      expect(screen.getByTestId('file-count')).toHaveTextContent('2');
    });
    expect(screen.getByTestId('active-file')).toHaveTextContent('src/main.ts');
    expect(screen.getByTestId('active-content')).toHaveTextContent(
      "console.log('hello')"
    );
    expect(screen.getByTestId('output')).toHaveTextContent(
      'User: hi|Assistant: hello'
    );

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    Object.defineProperty(window, 'crossOriginIsolated', {
      value: false,
      configurable: true
    });

    fireEvent.click(screen.getByRole('button', { name: '打开实验' }));

    await screen.findByText('unsupported');
    expect(screen.getByTestId('file-count')).toHaveTextContent('0');
    expect(screen.getByTestId('active-file')).toBeEmptyDOMElement();
    expect(screen.getByTestId('active-content')).toBeEmptyDOMElement();
    expect(screen.getByTestId('output')).toBeEmptyDOMElement();
    expect(
      screen.getByText('WebContainers require a compatible desktop browser.')
    ).toBeInTheDocument();
  });

  it('clears stale workspace state when booting the playground fails', async () => {
    render(
      <PlaygroundProvider>
        <PlaygroundHarness />
      </PlaygroundProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: '运行实验' }));

    await waitFor(() => {
      expect(screen.getByTestId('file-count')).toHaveTextContent('2');
    });
    expect(screen.getByTestId('active-content')).toHaveTextContent(
      "console.log('hello')"
    );
    expect(screen.getByTestId('output')).toHaveTextContent(
      'User: hi|Assistant: hello'
    );

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    getWebcontainerMock.mockRejectedValueOnce(new Error('boot failed'));

    fireEvent.click(screen.getByRole('button', { name: '打开实验' }));

    await waitFor(() => {
      expect(screen.getByText('boot failed')).toBeInTheDocument();
    });
    expect(screen.getByTestId('file-count')).toHaveTextContent('0');
    expect(screen.getByTestId('active-file')).toBeEmptyDOMElement();
    expect(screen.getByTestId('active-content')).toBeEmptyDOMElement();
    expect(screen.getByTestId('output')).toBeEmptyDOMElement();
  });

  it('ignores late async results from a previous open after a newer open fails', async () => {
    const firstFileList = createDeferred<string[]>();

    listWorkspaceFilesMock
      .mockImplementationOnce(() => firstFileList.promise)
      .mockResolvedValueOnce(['src/main.ts', 'src/config.ts']);

    render(
      <PlaygroundProvider>
        <PlaygroundHarness />
      </PlaygroundProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: '打开实验' }));

    await waitFor(() => {
      expect(listWorkspaceFilesMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    Object.defineProperty(window, 'crossOriginIsolated', {
      value: false,
      configurable: true
    });

    fireEvent.click(screen.getByRole('button', { name: '打开实验' }));

    await screen.findByText('unsupported');
    firstFileList.resolve(['src/main.ts', 'src/config.ts']);

    await waitFor(() => {
      expect(screen.getByTestId('file-count')).toHaveTextContent('0');
    });
    expect(screen.getByTestId('active-file')).toBeEmptyDOMElement();
    expect(screen.getByTestId('active-content')).toBeEmptyDOMElement();
  });
});
