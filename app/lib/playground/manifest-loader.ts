import manifest from '@/examples/labs/01-webcontainers-pilot/manifest.json';
import {
  parsePlaygroundManifest,
  type PlaygroundManifest
} from '@/app/lib/playground/manifest-schema';

const registry: Record<string, PlaygroundManifest> = {
  'labs-01-webcontainers-pilot': parsePlaygroundManifest(manifest)
};

export function getPlaygroundManifest(sectionId: string) {
  const entry = registry[sectionId];
  if (!entry) {
    throw new Error(`Unknown playground section: ${sectionId}`);
  }
  return entry;
}
