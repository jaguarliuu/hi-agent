import manifest from '@/examples/hi-agent/labs/01-webcontainers-pilot/manifest.json';
import {
  parsePlaygroundManifest,
  type PlaygroundManifest
} from '@/app/lib/playground/manifest-schema';

export function resolveManifestAssetPath(
  assetPath: string,
  basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
) {
  if (!assetPath.startsWith('/') || !basePath) {
    return assetPath;
  }

  return `${basePath}${assetPath}`;
}

const registry: Record<string, PlaygroundManifest> = {
  'labs-01-webcontainers-pilot': parsePlaygroundManifest({
    ...manifest,
    snapshotUrl: resolveManifestAssetPath(manifest.snapshotUrl)
  })
};

export function getPlaygroundManifest(sectionId: string) {
  const entry = registry[sectionId];
  if (!entry) {
    throw new Error(`Unknown playground section: ${sectionId}`);
  }
  return entry;
}
