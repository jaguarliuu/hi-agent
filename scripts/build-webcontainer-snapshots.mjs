import { spawn } from 'node:child_process';
import {
  access,
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { snapshot } from '@webcontainer/snapshot';

const isWindows = process.platform === 'win32';

function runNpm(args, options) {
  return new Promise((resolvePromise, rejectPromise) => {
    if (isWindows) {
      const command = ['npm', ...args]
        .map((part) => (/\s/.test(part) ? JSON.stringify(part) : part))
        .join(' ');
      const child = spawn(command, {
        ...options,
        shell: true,
        stdio: 'inherit'
      });
      child.on('error', rejectPromise);
      child.on('exit', (code) => {
        if (code === 0) resolvePromise();
        else rejectPromise(new Error(`npm ${args.join(' ')} exited with code ${code}`));
      });
      return;
    }
    const child = spawn('npm', args, {
      ...options,
      stdio: 'inherit'
    });
    child.on('error', rejectPromise);
    child.on('exit', (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`npm ${args.join(' ')} exited with code ${code}`));
    });
  });
}

const targets = [
  {
    sectionId: 'labs-01-webcontainers-pilot',
    sourceDir: resolve('examples/hi-agent/labs/01-webcontainers-pilot/workspace'),
    outFile: resolve('public/webcontainer-snapshots/labs-01-webcontainers-pilot.bin')
  },
  {
    sectionId: 'chat-01-getting-started',
    sourceDir: resolve('examples/hi-agent/chat/01-getting-started/workspace'),
    outFile: resolve('public/webcontainer-snapshots/chat-01-getting-started.bin')
  }
];

async function prepareWorkspace(sourceDir) {
  const stageRoot = await mkdtemp(join(tmpdir(), 'hi-agent-webcontainer-'));
  const stageDir = join(stageRoot, 'install-workspace');
  const snapshotDir = join(stageRoot, 'snapshot-workspace');

  await cp(sourceDir, stageDir, {
    recursive: true,
    filter(sourcePath) {
      return !sourcePath.includes(`${join('node_modules')}`);
    }
  });

  if (await workspaceHasDependencies(stageDir)) {
    try {
      await access(join(stageDir, 'node_modules'));
    } catch {
      console.log(`Installing workspace dependencies in ${stageDir}`);
      await runNpm(await getInstallArgs(stageDir), {
        cwd: stageDir
      });
    }
  }

  await cp(stageDir, snapshotDir, {
    recursive: true,
    dereference: true
  });

  await markBinariesExecutable(snapshotDir);

  return {
    stageRoot,
    snapshotDir
  };
}

async function markBinariesExecutable(rootDir) {
  const binDir = join(rootDir, 'node_modules', '.bin');
  let entries;
  try {
    entries = await readdir(binDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    try {
      await chmod(join(binDir, entry.name), 0o755);
    } catch {}
  }
}

async function getInstallArgs(stageDir) {
  try {
    await access(join(stageDir, 'package-lock.json'));
    return ['ci', '--no-audit', '--no-fund'];
  } catch {
    return ['install', '--no-audit', '--no-fund'];
  }
}

async function workspaceHasDependencies(stageDir) {
  const packageJson = JSON.parse(
    await readFile(join(stageDir, 'package.json'), 'utf8')
  );

  return (
    Object.keys(packageJson.dependencies ?? {}).length > 0 ||
    Object.keys(packageJson.devDependencies ?? {}).length > 0
  );
}

for (const target of targets) {
  const { stageRoot, snapshotDir } = await prepareWorkspace(target.sourceDir);

  try {
    const data = await snapshot(snapshotDir);
    await mkdir(dirname(target.outFile), { recursive: true });
    await writeFile(target.outFile, Buffer.from(data));
    console.log(`Generated snapshot for ${target.sectionId}`);
  } finally {
    await rm(stageRoot, { recursive: true, force: true });
  }
}
