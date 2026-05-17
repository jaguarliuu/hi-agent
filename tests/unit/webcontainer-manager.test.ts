import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaygroundManifest } from '@/app/lib/playground/manifest-schema';

const mountMock = vi.fn();
const spawnMock = vi.fn();
const exportMock = vi.fn();
const readdirMock = vi.fn();
const readFileMock = vi.fn();
const writeFileMock = vi.fn();
const bootMock = vi.fn();
const loadCachedWorkspaceMock = vi.fn();
const saveCachedWorkspaceMock = vi.fn();
const originalEnv = process.env;
let webcontainerMock: {
  mount: typeof mountMock;
  spawn: typeof spawnMock;
  export: typeof exportMock;
  fs: {
    readdir: typeof readdirMock;
    readFile: typeof readFileMock;
    writeFile: typeof writeFileMock;
  };
};

vi.mock('@webcontainer/api', () => ({
  WebContainer: {
    boot: bootMock
  }
}));

vi.mock('@/app/lib/playground/workspace-cache', () => ({
  loadCachedWorkspace: loadCachedWorkspaceMock,
  saveCachedWorkspace: saveCachedWorkspaceMock
}));

function createManifest(id: string): PlaygroundManifest {
  return {
    id,
    title: id,
    snapshotId: `${id}-snapshot`,
    snapshotUrl: `/${id}.bin`,
    defaultOpenFile: 'src/main.ts',
    startup: {
      installCommands: [{ cmd: 'npm', args: ['install'] }],
      runCommands: [],
      env: []
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
}

describe('prepareSectionWorkspace', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      OPENAI_API_KEY: 'test-key',
      OPENAI_BASE_URL: 'https://api.test/v1',
      IGNORED_ENV: 'ignored'
    };

    mountMock.mockResolvedValue(undefined);
    spawnMock.mockResolvedValue({
      exit: Promise.resolve(0),
      output: { pipeTo: vi.fn().mockResolvedValue(undefined) }
    });
    exportMock.mockResolvedValue(new Uint8Array([1, 2, 3]));
    readdirMock.mockResolvedValue([]);
    readFileMock.mockResolvedValue('');
    writeFileMock.mockResolvedValue(undefined);
    webcontainerMock = {
      mount: mountMock,
      spawn: spawnMock,
      export: exportMock,
      fs: {
        readdir: readdirMock,
        readFile: readFileMock,
        writeFile: writeFileMock
      }
    };
    bootMock.mockResolvedValue(webcontainerMock);
    loadCachedWorkspaceMock.mockResolvedValue(null);
    saveCachedWorkspaceMock.mockResolvedValue(undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
      })
    );
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('passes only manifest-declared environment variables to startup processes', async () => {
    const { prepareSectionWorkspace } = await import('@/app/lib/playground/webcontainer-manager');
    const manifest = {
      ...createManifest('labs-01-webcontainers-pilot'),
      startup: {
        installCommands: [{ cmd: 'npm', args: ['install'] }],
        runCommands: [],
        env: ['OPENAI_API_KEY', 'OPENAI_BASE_URL']
      }
    } satisfies PlaygroundManifest;

    await prepareSectionWorkspace(manifest);

    expect(spawnMock).toHaveBeenCalledWith('npm', ['install'], {
      output: true,
      env: {
        OPENAI_API_KEY: 'test-key',
        OPENAI_BASE_URL: 'https://api.test/v1'
      }
    });
  });

  it('starts the interactive shell with manifest env and dispatches startup run commands once', async () => {
    const inputWriteMock = vi.fn().mockResolvedValue(undefined);
    spawnMock.mockResolvedValueOnce({
      exit: new Promise(() => {}),
      input: {
        getWriter: () => ({
          write: inputWriteMock,
          close: vi.fn().mockResolvedValue(undefined)
        })
      },
      output: new ReadableStream(),
      resize: vi.fn(),
      kill: vi.fn()
    });
    const { runStartupCommands, teardownInteractiveShell } = await import(
      '@/app/lib/playground/webcontainer-manager'
    );
    const manifest = {
      ...createManifest('labs-01-webcontainers-pilot'),
      startup: {
        installCommands: [],
        runCommands: [{ cmd: 'npm', args: ['run', 'chat'] }],
        env: ['OPENAI_API_KEY']
      }
    } satisfies PlaygroundManifest;

    try {
      await runStartupCommands(manifest);
      await runStartupCommands(manifest);

      expect(spawnMock).toHaveBeenCalledWith('jsh', {
        terminal: { cols: 80, rows: 24 },
        env: { OPENAI_API_KEY: 'test-key' }
      });
      expect(inputWriteMock).toHaveBeenCalledTimes(1);
      expect(inputWriteMock).toHaveBeenCalledWith('npm run chat\n');
    } finally {
      await teardownInteractiveShell();
    }
  });

  it('reruns startup commands after tearing down the interactive shell', async () => {
    const firstInputWriteMock = vi.fn().mockResolvedValue(undefined);
    const firstKillMock = vi.fn();
    const secondInputWriteMock = vi.fn().mockResolvedValue(undefined);
    spawnMock
      .mockResolvedValueOnce({
        exit: new Promise(() => {}),
        input: {
          getWriter: () => ({
            write: firstInputWriteMock,
            close: vi.fn().mockResolvedValue(undefined)
          })
        },
        output: new ReadableStream(),
        resize: vi.fn(),
        kill: firstKillMock
      })
      .mockResolvedValueOnce({
        exit: new Promise(() => {}),
        input: {
          getWriter: () => ({
            write: secondInputWriteMock,
            close: vi.fn().mockResolvedValue(undefined)
          })
        },
        output: new ReadableStream(),
        resize: vi.fn(),
        kill: vi.fn()
      });
    const { runStartupCommands, teardownInteractiveShell } = await import(
      '@/app/lib/playground/webcontainer-manager'
    );
    const manifest = {
      ...createManifest('labs-01-webcontainers-pilot'),
      startup: {
        installCommands: [],
        runCommands: [{ cmd: 'npm', args: ['run', 'chat'] }],
        env: ['OPENAI_API_KEY']
      }
    } satisfies PlaygroundManifest;

    await runStartupCommands(manifest);
    await teardownInteractiveShell();
    await runStartupCommands(manifest);

    expect(firstKillMock).toHaveBeenCalledTimes(1);
    expect(firstInputWriteMock).toHaveBeenCalledWith('npm run chat\n');
    expect(secondInputWriteMock).toHaveBeenCalledWith('npm run chat\n');
  });

  it('does not remount or reinstall when preparing the same mounted section twice', async () => {
    const { prepareSectionWorkspace } = await import('@/app/lib/playground/webcontainer-manager');
    const manifest = createManifest('labs-01-webcontainers-pilot');

    await prepareSectionWorkspace(manifest);
    await prepareSectionWorkspace(manifest);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(mountMock).toHaveBeenCalledTimes(1);
    // First prepare: 1 install spawn + 1 chmod spawn for the .bin executable bit fix.
    // Second prepare hits the prepared-section guard and spawns nothing extra.
    expect(spawnMock).toHaveBeenCalledTimes(2);
    expect(spawnMock).toHaveBeenNthCalledWith(1, 'npm', ['install'], expect.any(Object));
    expect(spawnMock).toHaveBeenNthCalledWith(2, 'jsh', [
      '-c',
      expect.stringContaining('chmod -R +x node_modules/.bin')
    ]);
  });

  it('reinstalls after switching away and back to the same section', async () => {
    const { prepareSectionWorkspace } = await import('@/app/lib/playground/webcontainer-manager');
    const first = createManifest('labs-01-webcontainers-pilot');
    const second = createManifest('labs-02-other-pilot');

    await prepareSectionWorkspace(first);
    await prepareSectionWorkspace(second);
    await prepareSectionWorkspace(first);

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(mountMock).toHaveBeenCalledTimes(3);
    // Each prepare runs install + chmod, so 3 prepares spawn 6 commands total.
    expect(spawnMock).toHaveBeenCalledTimes(6);
  });

  it('retries boot after a transient failure', async () => {
    bootMock
      .mockRejectedValueOnce(new Error('boot failed'))
      .mockResolvedValueOnce(webcontainerMock);

    const { getWebcontainer } = await import('@/app/lib/playground/webcontainer-manager');

    await expect(getWebcontainer()).rejects.toThrow('boot failed');
    await expect(getWebcontainer()).resolves.toBe(webcontainerMock);
    expect(bootMock).toHaveBeenCalledTimes(2);
  });

  it('does not run install commands when the snapshot is already prepared', async () => {
    const { prepareSectionWorkspace } = await import('@/app/lib/playground/webcontainer-manager');
    const manifest = {
      ...createManifest('labs-01-webcontainers-pilot'),
      startup: {
        installCommands: [],
        runCommands: [],
        env: []
      }
    } satisfies PlaygroundManifest;

    await prepareSectionWorkspace(manifest);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(mountMock).toHaveBeenCalledTimes(1);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('lists workspace files from the project root recursively', async () => {
    readdirMock.mockImplementation(async (path: string) => {
      if (path === '.') {
        return [
          {
            name: 'src',
            isFile: () => false,
            isDirectory: () => true
          },
          {
            name: 'package.json',
            isFile: () => true,
            isDirectory: () => false
          },
          {
            name: 'tsconfig.json',
            isFile: () => true,
            isDirectory: () => false
          }
        ];
      }

      if (path === 'src') {
        return [
          {
            name: 'main.ts',
            isFile: () => true,
            isDirectory: () => false
          },
          {
            name: 'config.ts',
            isFile: () => true,
            isDirectory: () => false
          }
        ];
      }

      return [];
    });

    const { listWorkspaceFiles } = await import('@/app/lib/playground/webcontainer-manager');

    await expect(listWorkspaceFiles()).resolves.toEqual([
      'package.json',
      'src/config.ts',
      'src/main.ts',
      'tsconfig.json'
    ]);
  });
});
