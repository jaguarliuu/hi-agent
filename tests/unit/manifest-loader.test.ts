import { describe, expect, it } from 'vitest';
import { resolveManifestAssetPath } from '@/app/lib/playground/manifest-loader';

describe('resolveManifestAssetPath', () => {
  it('prefixes root-relative snapshot assets with the configured base path', () => {
    expect(
      resolveManifestAssetPath(
        '/webcontainer-snapshots/labs-01-webcontainers-pilot.bin',
        '/hi-agent'
      )
    ).toBe('/hi-agent/webcontainer-snapshots/labs-01-webcontainers-pilot.bin');
  });

  it('leaves asset paths unchanged when no base path is configured', () => {
    expect(
      resolveManifestAssetPath('/webcontainer-snapshots/labs-01-webcontainers-pilot.bin', '')
    ).toBe('/webcontainer-snapshots/labs-01-webcontainers-pilot.bin');
  });
});
