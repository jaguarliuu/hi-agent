import { beforeEach, describe, expect, it, vi } from 'vitest';
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

    mountMock.mockResolvedValue(undefined);
    spawnMock.mockResolvedValue({
      exit: Promise.resolve(0),
      output: { pipeTo: vi.fn().mockResolvedValue(undefined) }
    });
    exportMock.mockResolvedValue(new Uint8Array([1, 2, 3]));
    readdirMock.mockResolvedValue([]);
    readFileMock.mockResolvedValue('');
    writeFileMock.mockResolvedValue(undefined);
    bootMock.mockResolvedValue({
      mount: mountMock,
      spawn: spawnMock,
      export: exportMock,
      fs: {
        readdir: readdirMock,
        readFile: readFileMock,
        writeFile: writeFileMock
      }
    });
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

  it('does not remount or reinstall when preparing the same mounted section twice', async () => {
    const { prepareSectionWorkspace } = await import('@/app/lib/playground/webcontainer-manager');
    const manifest = createManifest('labs-01-webcontainers-pilot');

    await prepareSectionWorkspace(manifest);
    await prepareSectionWorkspace(manifest);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(mountMock).toHaveBeenCalledTimes(1);
    expect(spawnMock).toHaveBeenCalledTimes(1);
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
    expect(spawnMock).toHaveBeenCalledTimes(3);
  });
});
