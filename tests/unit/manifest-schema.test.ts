import { describe, expect, it } from 'vitest';
import pilotManifest from '@/examples/labs/01-webcontainers-pilot/manifest.json';
import {
  parsePlaygroundManifest,
  playgroundManifestSchema
} from '@/app/lib/playground/manifest-schema';

describe('playground manifest schema', () => {
  it('parses the pilot manifest and exposes the expected ids', () => {
    const manifest = parsePlaygroundManifest(pilotManifest);

    expect(manifest.id).toBe('labs-01-webcontainers-pilot');
    expect(manifest.defaultOpenFile).toBe('src/main.js');
    expect(manifest.blocks.map((block) => block.blockId)).toEqual([
      'install-deps',
      'open-example',
      'main-ts-snippet',
      'config-snippet',
      'run-demo'
    ]);
  });

  it('rejects unknown block types', () => {
    const result = playgroundManifestSchema.safeParse({
      ...pilotManifest,
      blocks: [{ blockId: 'bad-block', type: 'not-a-real-type' }]
    });

    expect(result.success).toBe(false);
  });
});
