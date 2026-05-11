import { execFile } from 'node:child_process';
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { snapshot } from '@webcontainer/snapshot';

const execFileAsync = promisify(execFile);

const targets = [
  {
    sectionId: 'labs-01-webcontainers-pilot',
    sourceDir: resolve('examples/labs/01-webcontainers-pilot/workspace'),
    outFile: resolve('public/webcontainer-snapshots/labs-01-webcontainers-pilot.bin')
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
      await execFileAsync('npm', ['ci', '--no-audit', '--no-fund'], {
        cwd: stageDir,
        maxBuffer: 10 * 1024 * 1024
      });
    }
  }

  await cp(stageDir, snapshotDir, {
    recursive: true,
    dereference: true
  });

  return {
    stageRoot,
    snapshotDir
  };
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
