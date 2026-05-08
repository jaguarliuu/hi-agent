import { WebContainer } from '@webcontainer/api';
import { loadCachedWorkspace, saveCachedWorkspace } from './workspace-cache';
import type { PlaygroundManifest } from './manifest-schema';

const CACHE_TTL_MS = 30 * 60 * 1000;
let bootPromise: Promise<WebContainer> | null = null;
const preparedSections = new Set<string>();

async function fetchSnapshot(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch snapshot: ${url}`);
  }

  return response.arrayBuffer();
}

export async function getWebcontainer() {
  if (!bootPromise) {
    bootPromise = WebContainer.boot();
  }

  return bootPromise;
}

export async function mountSectionWorkspace(manifest: PlaygroundManifest) {
  const webcontainer = await getWebcontainer();
  const restored = await loadCachedWorkspace(manifest.id);
  const snapshot = restored ?? (await fetchSnapshot(manifest.snapshotUrl));
  await webcontainer.mount(snapshot);
  return webcontainer;
}

export async function prepareSectionWorkspace(manifest: PlaygroundManifest) {
  const webcontainer = await mountSectionWorkspace(manifest);

  if (!preparedSections.has(manifest.id)) {
    for (const command of manifest.startup.installCommands) {
      const process = await webcontainer.spawn(command.cmd, command.args, {
        output: true
      });
      const exitCode = await process.exit;
      if (exitCode !== 0) {
        throw new Error(`Install command failed: ${command.cmd} ${command.args.join(' ')}`);
      }
    }
    preparedSections.add(manifest.id);
  }

  return webcontainer;
}

export async function listWorkspaceFiles() {
  const webcontainer = await getWebcontainer();
  const entries = await webcontainer.fs.readdir('src', { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => `src/${entry.name}`);
}

export async function readWorkspaceFile(path: string) {
  const webcontainer = await getWebcontainer();
  return webcontainer.fs.readFile(path, 'utf-8');
}

export async function writeWorkspaceFile(path: string, content: string) {
  const webcontainer = await getWebcontainer();
  await webcontainer.fs.writeFile(path, content);
}

export async function persistSectionWorkspace(manifest: PlaygroundManifest) {
  const webcontainer = await getWebcontainer();
  const snapshot = await webcontainer.export('/', {
    format: 'binary',
    excludes: ['node_modules/**']
  });

  if (snapshot instanceof Uint8Array) {
    await saveCachedWorkspace(manifest.id, snapshot.slice().buffer, CACHE_TTL_MS);
  }
}

export async function runManifestCommand(
  manifest: PlaygroundManifest,
  blockId: string,
  onOutput: (chunk: string) => void
) {
  const webcontainer = await prepareSectionWorkspace(manifest);
  const block = manifest.blocks.find(
    (entry) => entry.blockId === blockId && entry.type === 'command'
  );

  if (!block || block.type !== 'command') {
    throw new Error(`Unknown command block: ${blockId}`);
  }

  const process = await webcontainer.spawn(block.command.cmd, block.command.args, {
    output: true
  });

  process.output.pipeTo(
    new WritableStream({
      write(chunk) {
        onOutput(chunk);
      }
    })
  );

  const exitCode = await process.exit;
  await persistSectionWorkspace(manifest);
  return exitCode;
}
