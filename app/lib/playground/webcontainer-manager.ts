import { WebContainer, type WebContainerProcess } from '@webcontainer/api';
import { loadCachedWorkspace } from './workspace-cache';
import type { PlaygroundManifest } from './manifest-schema';

const IGNORED_DIRECTORIES = new Set(['.git', '.next', 'node_modules', 'out']);
let bootPromise: Promise<WebContainer> | null = null;
let mountedSectionId: string | null = null;
let preparedSectionId: string | null = null;
let startupShell: InteractiveShellHandle | null = null;
let startupKey: string | null = null;
let activeShellEnvKey: string | null = null;

export interface InteractiveShellHandle {
  process: WebContainerProcess;
  input: WritableStreamDefaultWriter<string>;
  output: ReadableStream<string>;
  resize: (cols: number, rows: number) => void;
  dispose: () => Promise<void>;
}

let activeShell: InteractiveShellHandle | null = null;
let activeShellSectionId: string | null = null;

async function fetchSnapshot(
  url: string,
  onProgress?: (loaded: number, total: number | null) => void
) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch snapshot: ${url}`);
  }

  const totalHeader =
    typeof response.headers?.get === 'function'
      ? response.headers.get('content-length')
      : null;
  const total = totalHeader ? Number.parseInt(totalHeader, 10) : null;
  const totalOrNull = Number.isFinite(total) && total !== null ? total : null;

  if (!response.body || typeof response.body.getReader !== 'function') {
    const buffer = await response.arrayBuffer();
    onProgress?.(buffer.byteLength, totalOrNull ?? buffer.byteLength);
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  // Surface an initial 0% so UI can react before the first chunk arrives.
  onProgress?.(0, totalOrNull);
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.byteLength;
      onProgress?.(loaded, totalOrNull);
    }
  }

  const merged = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
}

/**
 * Warm the HTTP cache for a snapshot without mounting it. Safe to call from
 * idle callbacks while the user is reading the surrounding documentation.
 */
export async function prefetchSnapshot(url: string) {
  if (typeof fetch !== 'function') return;
  try {
    await fetch(url, { credentials: 'omit', cache: 'force-cache' });
  } catch {
    // Network/CORS errors here are not actionable; the real fetch on open
    // will surface a meaningful failure.
  }
}

/**
 * Eagerly boot the WebContainer runtime without touching any workspace. Used
 * to overlap WASM startup with the time the user spends reading the page.
 */
export async function prebootWebcontainer() {
  if (typeof window === 'undefined') return;
  if (!window.crossOriginIsolated) return;
  try {
    await getWebcontainer();
  } catch {
    // Swallow boot errors during prewarm; the next user-initiated open will
    // trigger a real boot attempt with proper error reporting.
  }
}


function getManifestEnv(manifest: PlaygroundManifest) {
  const env: Record<string, string> = {};
  const source = globalThis.process?.env;

  for (const name of manifest.startup.env) {
    const value = source?.[name];
    if (typeof value === 'string' && value.length > 0) {
      env[name] = value;
    }
  }

  return env;
}

function getSpawnOptionsEnv(manifest: PlaygroundManifest) {
  const env = getManifestEnv(manifest);
  return Object.keys(env).length > 0 ? env : undefined;
}

function getEnvKey(env: Record<string, string> | undefined) {
  if (!env) {
    return '';
  }

  return Object.keys(env)
    .sort()
    .map((name) => `${name}=${env[name]}`)
    .join('\n');
}

function getStartupKey(sectionId: string, env: Record<string, string> | undefined) {
  return `${sectionId}\n${getEnvKey(env)}`;
}

function resetStartupState(handle?: InteractiveShellHandle) {
  if (!handle || startupShell === handle) {
    startupShell = null;
    startupKey = null;
  }
}

function commandToLine(command: PlaygroundManifest['startup']['runCommands'][number]) {
  return [command.cmd, ...command.args].join(' ');
}

export async function getWebcontainer() {
  if (!bootPromise) {
    bootPromise = WebContainer.boot().catch((error) => {
      bootPromise = null;
      throw error;
    });
  }

  return bootPromise;
}

export async function mountSectionWorkspace(
  manifest: PlaygroundManifest,
  options: { onSnapshotProgress?: (loaded: number, total: number | null) => void } = {}
) {
  const webcontainer = await getWebcontainer();
  if (mountedSectionId === manifest.id) {
    options.onSnapshotProgress?.(1, 1);
    return webcontainer;
  }

  const restored = await loadCachedWorkspace(manifest.id, manifest.snapshotId);
  const snapshot =
    restored ??
    (await fetchSnapshot(manifest.snapshotUrl, options.onSnapshotProgress));
  if (restored) {
    options.onSnapshotProgress?.(1, 1);
  }
  await webcontainer.mount(snapshot);
  mountedSectionId = manifest.id;
  preparedSectionId = null;
  resetStartupState();
  return webcontainer;
}

export async function prepareSectionWorkspace(
  manifest: PlaygroundManifest,
  options: { onSnapshotProgress?: (loaded: number, total: number | null) => void } = {}
) {
  const webcontainer = await mountSectionWorkspace(manifest, options);

  if (preparedSectionId !== manifest.id) {
    const env = getSpawnOptionsEnv(manifest);
    for (const command of manifest.startup.installCommands) {
      const process = await webcontainer.spawn(command.cmd, command.args, {
        output: true,
        ...(env ? { env } : {})
      });
      const exitCode = await process.exit;
      if (exitCode !== 0) {
        throw new Error(`Install command failed: ${command.cmd} ${command.args.join(' ')}`);
      }
    }
    if (manifest.startup.installCommands.length > 0) {
      await ensureBinariesExecutable(webcontainer);
    }
    preparedSectionId = manifest.id;
  }

  return webcontainer;
}

async function ensureBinariesExecutable(webcontainer: WebContainer) {
  try {
    const proc = await webcontainer.spawn('jsh', [
      '-c',
      'if [ -d node_modules/.bin ]; then chmod -R +x node_modules/.bin 2>/dev/null || true; fi'
    ]);
    await proc.exit;
  } catch {
    // best-effort; ignore if jsh is unavailable in this snapshot
  }
}

async function walkWorkspaceDirectory(
  webcontainer: WebContainer,
  directory: string
): Promise<string[]> {
  const entries = await webcontainer.fs.readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = directory === '.' ? entry.name : `${directory}/${entry.name}`;

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      files.push(...(await walkWorkspaceDirectory(webcontainer, entryPath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

export async function listWorkspaceFiles() {
  const webcontainer = await getWebcontainer();
  const files = await walkWorkspaceDirectory(webcontainer, '.');
  return files.sort((left, right) => left.localeCompare(right));
}

export async function readWorkspaceFile(path: string) {
  const webcontainer = await getWebcontainer();
  return webcontainer.fs.readFile(path, 'utf-8');
}

export async function writeWorkspaceFile(path: string, content: string) {
  const webcontainer = await getWebcontainer();
  await webcontainer.fs.writeFile(path, content);
}

export async function workspaceFileExists(path: string) {
  const webcontainer = await getWebcontainer();
  try {
    await webcontainer.fs.readFile(path);
    return true;
  } catch {
    return false;
  }
}

export async function createWorkspaceFile(path: string, content = '') {
  const webcontainer = await getWebcontainer();
  const slashIndex = path.lastIndexOf('/');
  if (slashIndex > 0) {
    const dir = path.slice(0, slashIndex);
    await webcontainer.fs.mkdir(dir, { recursive: true });
  }
  await webcontainer.fs.writeFile(path, content);
}

export async function watchWorkspace(onChange: () => void) {
  const webcontainer = await getWebcontainer();
  let cancelled = false;
  let watcher: { close: () => void } | null = null;
  try {
    const result = webcontainer.fs.watch(
      '.',
      { recursive: true },
      () => {
        if (!cancelled) onChange();
      }
    );
    watcher = result as unknown as { close: () => void };
  } catch {
    return () => {};
  }
  return () => {
    cancelled = true;
    try {
      watcher?.close?.();
    } catch {}
  };
}

export async function runManifestCommand(
  manifest: PlaygroundManifest,
  blockId: string
) {
  await prepareSectionWorkspace(manifest);
  const block = manifest.blocks.find(
    (entry) => entry.blockId === blockId && entry.type === 'command'
  );

  if (!block || block.type !== 'command') {
    throw new Error(`Unknown command block: ${blockId}`);
  }

  const commandLine = [block.command.cmd, ...block.command.args]
    .map((part) => part)
    .join(' ');

  const shell = await ensureManifestInteractiveShell(manifest);
  await shell.input.write(`${commandLine}\n`);
  return commandLine;
}

export async function runStartupCommands(manifest: PlaygroundManifest) {
  await prepareSectionWorkspace(manifest);
  const env = getSpawnOptionsEnv(manifest);
  const nextStartupKey = getStartupKey(manifest.id, env);
  const shell = await ensureInteractiveShell(manifest.id, env);

  if (startupShell === shell && startupKey === nextStartupKey) {
    return;
  }

  for (const command of manifest.startup.runCommands) {
    await shell.input.write(`${commandToLine(command)}\n`);
  }
  startupShell = shell;
  startupKey = nextStartupKey;
}

export async function ensureManifestInteractiveShell(manifest: PlaygroundManifest) {
  return ensureInteractiveShell(manifest.id, getSpawnOptionsEnv(manifest));
}

async function spawnShell(
  sectionId: string,
  env?: Record<string, string>
): Promise<InteractiveShellHandle> {
  const webcontainer = await getWebcontainer();
  const process = await webcontainer.spawn('jsh', {
    terminal: { cols: 80, rows: 24 },
    ...(env ? { env } : {})
  });

  const input = process.input.getWriter();

  const handle: InteractiveShellHandle = {
    process,
    input,
    output: process.output,
    resize(cols, rows) {
      process.resize({ cols, rows });
    },
    async dispose() {
      try {
        await input.close();
      } catch {}
      try {
        process.kill();
      } catch {}
    }
  };

  void process.exit.finally(() => {
    if (activeShell === handle) {
      activeShell = null;
      activeShellSectionId = null;
      activeShellEnvKey = null;
    }
    resetStartupState(handle);
  });

  activeShell = handle;
  activeShellSectionId = sectionId;
  activeShellEnvKey = getEnvKey(env);
  return handle;
}

export async function ensureInteractiveShell(
  sectionId: string,
  env?: Record<string, string>
) {
  const envKey = getEnvKey(env);
  if (
    activeShell &&
    activeShellSectionId === sectionId &&
    activeShellEnvKey === envKey
  ) {
    return activeShell;
  }

  if (activeShell) {
    resetStartupState(activeShell);
    await activeShell.dispose();
    activeShell = null;
    activeShellSectionId = null;
    activeShellEnvKey = null;
  }

  return spawnShell(sectionId, env);
}

export async function teardownInteractiveShell() {
  if (!activeShell) return;
  const handle = activeShell;
  activeShell = null;
  activeShellSectionId = null;
  activeShellEnvKey = null;
  resetStartupState(handle);
  await handle.dispose();
}
