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
import {
  flushTransition,
  withReducedMotion
} from '@/tests/helpers/motion-test-utils';

const {
  getPlaygroundManifestMock,
  getWebcontainerMock,
  listWorkspaceFilesMock,
  prepareSectionWorkspaceMock,
  readWorkspaceFileMock,
  runManifestCommandMock,
  runStartupCommandsMock,
  writeWorkspaceFileMock,
  ensureInteractiveShellMock,
  teardownInteractiveShellMock
} = vi.hoisted(() => ({
  getPlaygroundManifestMock: vi.fn(),
  getWebcontainerMock: vi.fn(),
  listWorkspaceFilesMock: vi.fn(),
  prepareSectionWorkspaceMock: vi.fn(),
  readWorkspaceFileMock: vi.fn(),
  runManifestCommandMock: vi.fn(),
  runStartupCommandsMock: vi.fn(),
  writeWorkspaceFileMock: vi.fn(),
  ensureInteractiveShellMock: vi.fn(),
  teardownInteractiveShellMock: vi.fn()
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

vi.mock('@/app/lib/playground/playground-terminal', () => ({
  PlaygroundTerminal: function MockPlaygroundTerminal() {
    return <div data-testid="playground-terminal" />;
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
  runStartupCommands: runStartupCommandsMock,
  writeWorkspaceFile: writeWorkspaceFileMock,
  ensureInteractiveShell: ensureInteractiveShellMock,
  teardownInteractiveShell: teardownInteractiveShellMock,
  watchWorkspace: vi.fn().mockResolvedValue(() => {}),
  createWorkspaceFile: vi.fn().mockResolvedValue(undefined),
  workspaceFileExists: vi.fn().mockResolvedValue(false)
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
      bootStage: 'ready',
      sectionId: manifest.id,
      activeFile: 'src/main.ts',
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
    activeFileAnchor: null,
    openProject: vi.fn(),
    runCommand: vi.fn(),
    openFile: vi.fn(),
    closeDrawer: vi.fn(),
    selectFile: vi.fn(),
    updateActiveFile: vi.fn(),
    createFile: vi.fn()
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
      <div data-testid="error">{state.error ?? ''}</div>
    </>
  );
}

function getDrawer() {
  return screen.queryByLabelText('Runnable playground');
}

function getBackdrop() {
  return document.querySelector('[data-playground-backdrop]');
}

function getBootStageNode() {
  return document.querySelector<HTMLElement>('[data-boot-stage]');
}

function collectCommittedDrawerPhases() {
  const phases = new Set<string>();
  const captureNode = (node: Node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }

    if (node.hasAttribute('data-drawer-phase')) {
      phases.add(node.getAttribute('data-drawer-phase') ?? '');
    }

    node.querySelectorAll<HTMLElement>('[data-drawer-phase]').forEach((element) => {
      phases.add(element.getAttribute('data-drawer-phase') ?? '');
    });
  };

  captureNode(document.body);

  const recordObserver = new MutationObserver((records) => {
    records.forEach((record) => {
      if (record.type === 'attributes') {
        captureNode(record.target);
        return;
      }

      record.addedNodes.forEach(captureNode);
      record.removedNodes.forEach(captureNode);
    });
  });

  recordObserver.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-drawer-phase']
  });

  return {
    phases,
    disconnect: () => recordObserver.disconnect()
  };
}

describe('PlaygroundDrawer', () => {
  beforeEach(() => {
    getPlaygroundManifestMock.mockReturnValue(manifest);
    getWebcontainerMock.mockResolvedValue({});
    listWorkspaceFilesMock.mockResolvedValue(['src/main.ts', 'src/config.ts']);
    prepareSectionWorkspaceMock.mockResolvedValue(undefined);
    readWorkspaceFileMock.mockResolvedValue("console.log('hello')");
    runManifestCommandMock.mockResolvedValue('npm run chat');
    runStartupCommandsMock.mockResolvedValue(undefined);
    writeWorkspaceFileMock.mockResolvedValue(undefined);
    ensureInteractiveShellMock.mockResolvedValue({
      process: {},
      input: { write: vi.fn().mockResolvedValue(undefined) },
      output: new ReadableStream(),
      resize: vi.fn(),
      dispose: vi.fn().mockResolvedValue(undefined)
    });
    teardownInteractiveShellMock.mockResolvedValue(undefined);
    Object.defineProperty(window, 'crossOriginIsolated', {
      value: true,
      configurable: true
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the playground title, file tree, editor, and terminal', () => {
    render(
      <PlaygroundContext.Provider value={createContextValue()}>
        <PlaygroundDrawer phase="open" onPhaseComplete={vi.fn()} />
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
    expect(screen.getByTestId('playground-terminal')).toBeInTheDocument();
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

  it('surfaces boot narrative stages while opening the playground', async () => {
    const webcontainerReady = createDeferred<{}>();
    const workspaceReady = createDeferred<void>();
    const shellReady = createDeferred<{
      process: {};
      input: { write: ReturnType<typeof vi.fn> };
      output: ReadableStream;
      resize: ReturnType<typeof vi.fn>;
      dispose: ReturnType<typeof vi.fn>;
    }>();

    getWebcontainerMock.mockImplementationOnce(() => webcontainerReady.promise);
    prepareSectionWorkspaceMock.mockImplementationOnce(() => workspaceReady.promise);
    ensureInteractiveShellMock.mockImplementationOnce(() => shellReady.promise);

    render(
      <PlaygroundProvider>
        <PlaygroundHarness />
      </PlaygroundProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: '打开实验' }));

    await waitFor(
      () => {
        expect(getBootStageNode()).toHaveAttribute('data-boot-stage', 'prelude');
      },
      { timeout: 1000 }
    );
    expect(screen.getByText('启动前奏')).toBeInTheDocument();

    await screen.findByText('加载内核', {}, { timeout: 1000 });
    expect(getBootStageNode()).toHaveAttribute('data-boot-stage', 'loading-kernel');

    webcontainerReady.resolve({});
    await screen.findByText('挂载快照', {}, { timeout: 1000 });
    expect(getBootStageNode()).toHaveAttribute(
      'data-boot-stage',
      'mounting-snapshot'
    );

    workspaceReady.resolve(undefined);
    await screen.findByText('启动终端', {}, { timeout: 1000 });
    expect(getBootStageNode()).toHaveAttribute('data-boot-stage', 'starting-shell');

    shellReady.resolve({
      process: {},
      input: { write: vi.fn().mockResolvedValue(undefined) },
      output: new ReadableStream(),
      resize: vi.fn(),
      dispose: vi.fn().mockResolvedValue(undefined)
    });
    await screen.findByText('准备就绪', {}, { timeout: 1000 });
    expect(getBootStageNode()).toHaveAttribute('data-boot-stage', 'ready');
  });

  it('keeps explicit opening, open, and closing phases around the drawer lifecycle', async () => {
    render(
      <PlaygroundProvider>
        <PlaygroundHarness />
      </PlaygroundProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: '打开实验' }));

    await waitFor(() => {
      expect(getDrawer()).toHaveAttribute('data-drawer-phase', 'opening');
    });
    expect(getBackdrop()).toHaveAttribute('data-drawer-phase', 'opening');
    await waitFor(() => {
      expect(getDrawer()).toHaveAttribute('data-drawer-transition', 'active');
    });

    flushTransition(getDrawer()!);

    await waitFor(() => {
      expect(getDrawer()).toHaveAttribute('data-drawer-phase', 'open');
    });
    expect(getBackdrop()).toHaveAttribute('data-drawer-phase', 'open');

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));

    expect(getDrawer()).toHaveAttribute('data-drawer-phase', 'closing');
    expect(getBackdrop()).toHaveAttribute('data-drawer-phase', 'closing');

    flushTransition(getDrawer()!);

    await waitFor(() => {
      expect(getDrawer()).not.toBeInTheDocument();
    });
    expect(getBackdrop()).not.toBeInTheDocument();
  });

  it('closes to the fully closed state under reduced motion without waiting for a tween', async () => {
    await withReducedMotion(true, async () => {
      render(
        <PlaygroundProvider>
          <PlaygroundHarness />
        </PlaygroundProvider>
      );

      fireEvent.click(screen.getByRole('button', { name: '打开实验' }));

      await waitFor(() => {
        expect(getDrawer()).toHaveAttribute('data-drawer-phase', 'open');
      });

      const committedPhases = collectCommittedDrawerPhases();
      fireEvent.click(screen.getByRole('button', { name: '关闭' }));

      expect(getDrawer()).toHaveAttribute('data-drawer-phase', 'closing');
      expect(getBackdrop()).toHaveAttribute('data-drawer-phase', 'closing');
      await Promise.resolve();
      expect(committedPhases.phases).toContain('closing');

      await waitFor(() => {
        expect(getDrawer()).not.toBeInTheDocument();
      });
      committedPhases.disconnect();

      expect(getBackdrop()).not.toBeInTheDocument();
    });
  });

  it('finishes closing if interrupted before the opening transition starts', async () => {
    const requestAnimationFrameMock = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation(() => 1);
    const cancelAnimationFrameMock = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => {});

    try {
      render(
        <PlaygroundProvider>
          <PlaygroundHarness />
        </PlaygroundProvider>
      );

      fireEvent.click(screen.getByRole('button', { name: '打开实验' }));

      await waitFor(() => {
        expect(getDrawer()).toHaveAttribute('data-drawer-phase', 'opening');
      });
      expect(getDrawer()).toHaveAttribute('data-drawer-transition', 'idle');

      fireEvent.click(screen.getByRole('button', { name: '关闭' }));

      expect(getDrawer()).toHaveAttribute('data-drawer-phase', 'closing');

      await waitFor(() => {
        expect(getDrawer()).not.toBeInTheDocument();
      });

      expect(getBackdrop()).not.toBeInTheDocument();
      expect(cancelAnimationFrameMock).toHaveBeenCalled();
    } finally {
      requestAnimationFrameMock.mockRestore();
      cancelAnimationFrameMock.mockRestore();
    }
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

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    getWebcontainerMock.mockRejectedValueOnce(new Error('boot failed'));

    fireEvent.click(screen.getByRole('button', { name: '打开实验' }));

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('boot failed');
    });
    expect(screen.getByTestId('file-count')).toHaveTextContent('0');
    expect(screen.getByTestId('active-file')).toBeEmptyDOMElement();
    expect(screen.getByTestId('active-content')).toBeEmptyDOMElement();
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
