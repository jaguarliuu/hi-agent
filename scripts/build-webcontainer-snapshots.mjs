import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { snapshot } from '@webcontainer/snapshot';

const targets = [
  {
    sectionId: 'labs-01-webcontainers-pilot',
    sourceDir: resolve('examples/labs/01-webcontainers-pilot/workspace'),
    outFile: resolve('public/webcontainer-snapshots/labs-01-webcontainers-pilot.bin')
  }
];

for (const target of targets) {
  const data = await snapshot(target.sourceDir);
  await mkdir(dirname(target.outFile), { recursive: true });
  await writeFile(target.outFile, Buffer.from(data));
  console.log(`Generated snapshot for ${target.sectionId}`);
}
