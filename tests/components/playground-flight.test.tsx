import React, { useEffect, useRef } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startPlaygroundFlight } from '@/app/lib/motion/playground-flight';
import { RunnableCodeBlock } from '@/app/lib/runnable-code-block';
import { PlaygroundProvider } from '@/app/lib/playground/playground-provider';
import { PlaygroundSection } from '@/app/lib/playground/playground-section';
import type { PlaygroundManifest } from '@/app/lib/playground/manifest-schema';
import {
  flushTransition,
  withReducedMotion
} from '@/tests/helpers/motion-test-utils';

const {
  editorApi,
  getPlaygroundManifestMock,
  getWebcontainerMock,
  listWorkspaceFilesMock,
  prepareSectionWorkspaceMock,
  readWorkspaceFileMock,
  ensureInteractiveShellMock
} = vi.hoisted(() => ({
  editorApi: {
    setPosition: vi.fn(),
    revealLineInCenter: vi.fn(),
    deltaDecorations: vi.fn().mockReturnValue([])
  },
  getPlaygroundManifestMock: vi.fn(),
  getWebcontainerMock: vi.fn(),
  listWorkspaceFilesMock: vi.fn(),
  prepareSectionWorkspaceMock: vi.fn(),
  readWorkspaceFileMock: vi.fn(),
  ensureInteractiveShellMock: vi.fn()
}));

vi.mock('@monaco-editor/react', () => ({
  default: function MockMonacoEditor({
    value,
    onMount
  }: {
    value?: string;
    onMount?: (editor: typeof editorApi) => void;
  }) {
    const didMountRef = useRef(false);

    useEffect(() => {
      if (didMountRef.current) {
        return;
      }

      didMountRef.current = true;
      onMount?.(editorApi);
    }, [onMount]);

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
  ensureInteractiveShell: ensureInteractiveShellMock,
  runManifestCommand: vi.fn(),
  teardownInteractiveShell: vi.fn(),
  writeWorkspaceFile: vi.fn()
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
      blockId: 'show-main',
      type: 'file-snippet',
      path: 'src/main.ts',
      anchor: '@anchor:main-entry'
    }
  ]
};

function FlightHarness() {
  return (
    <PlaygroundProvider>
      <PlaygroundSection sectionId={manifest.id}>
        <RunnableCodeBlock blockId="show-main">
          <pre>
            <code>{'// @anchor:main-entry\nconsole.log("hello");'}</code>
          </pre>
        </RunnableCodeBlock>
      </PlaygroundSection>
    </PlaygroundProvider>
  );
}

function getDrawer() {
  return screen.queryByLabelText('Runnable playground');
}

function mockRect({
  top,
  left,
  width,
  height
}: {
  top: number;
  left: number;
  width: number;
  height: number;
}) {
  return {
    x: left,
    y: top,
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => null
  } as DOMRect;
}

describe('playground flight orchestration', () => {
  beforeEach(() => {
    editorApi.setPosition.mockClear();
    editorApi.revealLineInCenter.mockClear();
    editorApi.deltaDecorations.mockClear();
    getPlaygroundManifestMock.mockReturnValue(manifest);
    getWebcontainerMock.mockResolvedValue({});
    listWorkspaceFilesMock.mockResolvedValue(['src/main.ts']);
    prepareSectionWorkspaceMock.mockResolvedValue(undefined);
    readWorkspaceFileMock.mockResolvedValue(
      ['// @anchor:main-entry', 'console.log("hello");'].join('\n')
    );
    ensureInteractiveShellMock.mockResolvedValue({
      process: {},
      input: { write: vi.fn().mockResolvedValue(undefined) },
      output: new ReadableStream(),
      resize: vi.fn(),
      dispose: vi.fn().mockResolvedValue(undefined)
    });
    Object.defineProperty(window, 'crossOriginIsolated', {
      value: true,
      configurable: true
    });

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function mockBoundingClientRect() {
        const element = this as HTMLElement;

        if (element.hasAttribute('data-playground-flight-source')) {
          return mockRect({ top: 24, left: 32, width: 112, height: 36 });
        }

        if (element.hasAttribute('data-playground-flight-target')) {
          return mockRect({ top: 80, left: 320, width: 240, height: 44 });
        }

        return mockRect({ top: 0, left: 0, width: 0, height: 0 });
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits source metadata, flies to the opened editor target, cleans up the clone, and applies editor highlight feedback', async () => {
    render(<FlightHarness />);

    const action = screen.getByRole('button', { name: '应用' });
    expect(action).toHaveAttribute(
      'data-playground-flight-source',
      'labs-01-webcontainers-pilot:show-main:file'
    );

    fireEvent.click(action);

    await waitFor(() => {
      expect(getDrawer()).toHaveAttribute('data-drawer-phase', 'opening');
    });

    flushTransition(getDrawer()!);

    await waitFor(() => {
      expect(getDrawer()).toHaveAttribute('data-drawer-phase', 'open');
    });

    await waitFor(() => {
      expect(
        document.querySelector('[data-playground-flight-target="src/main.ts"]')
      ).toBeInTheDocument();
    });

    const clone = await waitFor(() => {
      const node = document.querySelector<HTMLElement>('[data-playground-flight-clone]');

      expect(node).toBeTruthy();
      return node!;
    });

    expect(editorApi.deltaDecorations).toHaveBeenCalledWith(
      [],
      expect.arrayContaining([
        expect.objectContaining({
          options: expect.objectContaining({
            className: 'ha-playground-editor-highlight'
          })
        })
      ])
    );

    await waitFor(
      () => {
        expect(editorApi.deltaDecorations).toHaveBeenNthCalledWith(2, [], []);
      },
      { timeout: 1500 }
    );

    flushTransition(clone);

    await waitFor(() => {
      expect(
        document.querySelector('[data-playground-flight-clone]')
      ).not.toBeInTheDocument();
    });
  });

  it('skips the flight clone under reduced motion while still applying editor highlight feedback', async () => {
    await withReducedMotion(true, async () => {
      render(<FlightHarness />);

      fireEvent.click(screen.getByRole('button', { name: '应用' }));

      await waitFor(() => {
        expect(getDrawer()).toHaveAttribute('data-drawer-phase', 'open');
      });

      await waitFor(() => {
        expect(
          document.querySelector('[data-playground-flight-target="src/main.ts"]')
        ).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(editorApi.deltaDecorations).toHaveBeenCalledWith(
          [],
          expect.arrayContaining([
            expect.objectContaining({
              options: expect.objectContaining({
                className: 'ha-playground-editor-highlight'
              })
            })
          ])
        );
      });

      await waitFor(
        () => {
          expect(editorApi.deltaDecorations).toHaveBeenNthCalledWith(2, [], []);
        },
        { timeout: 1000 }
      );

      expect(
        document.querySelector('[data-playground-flight-clone]')
      ).not.toBeInTheDocument();
    });
  });

  it('keeps the flight clone alive until the computed transition duration fallback expires', () => {
    vi.useFakeTimers();
    const sourceId = 'source';
    const targetId = 'target';

    const source = document.createElement('button');
    source.setAttribute('data-playground-flight-source', sourceId);
    document.body.append(source);

    const target = document.createElement('div');
    target.setAttribute('data-playground-flight-target', targetId);
    document.body.append(target);

    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      if ((element as HTMLElement).hasAttribute('data-playground-flight-clone')) {
        return {
          ...originalGetComputedStyle(element),
          transitionDuration: '1280ms, 960ms',
          transitionDelay: '0ms, 0ms'
        } as CSSStyleDeclaration;
      }

      return originalGetComputedStyle(element);
    });

    const clone = startPlaygroundFlight({ sourceId, targetId });

    expect(clone).toBeTruthy();
    expect(document.querySelector('[data-playground-flight-clone]')).toBe(clone);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(
      document.querySelector('[data-playground-flight-clone]')
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(
      document.querySelector('[data-playground-flight-clone]')
    ).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});
