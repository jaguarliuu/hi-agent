import { describe, expect, it } from 'vitest';
import pilotManifest from '@/examples/hi-agent/labs/01-webcontainers-pilot/manifest.json';
import chatGettingStartedManifest from '@/examples/hi-agent/chat/01-getting-started/manifest.json';
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

  it('parses the chat getting started manifest and exposes the expected ids', () => {
    const manifest = parsePlaygroundManifest(chatGettingStartedManifest);

    expect(manifest.id).toBe('chat-01-getting-started');
    expect(manifest.defaultOpenFile).toBe('src/main.ts');
    expect(manifest.startup.env).toEqual([
      'OPENAI_BASE_URL',
      'OPENAI_API_KEY',
      'OPENAI_MODEL'
    ]);
    expect(manifest.blocks.map((block) => block.blockId)).toEqual([
      'install-deps',
      'open-example',
      'config-snippet',
      'provider-snippet',
      'client-snippet',
      'session-snippet',
      'main-snippet',
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
