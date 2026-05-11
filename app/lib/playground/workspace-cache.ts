import { del, get, set } from 'idb-keyval';

interface CachedWorkspaceRecord {
  snapshot: ArrayBuffer;
  expiresAt: number;
}

function key(sectionId: string, snapshotId: string) {
  return `playground:${sectionId}:${snapshotId}`;
}

export async function saveCachedWorkspace(
  sectionId: string,
  snapshotId: string,
  snapshot: ArrayBuffer,
  ttlMs: number
) {
  await set(key(sectionId, snapshotId), {
    snapshot,
    expiresAt: Date.now() + ttlMs
  } satisfies CachedWorkspaceRecord);
}

export async function loadCachedWorkspace(sectionId: string, snapshotId: string) {
  const record = await get<CachedWorkspaceRecord>(key(sectionId, snapshotId));
  if (!record) {
    return null;
  }

  if (record.expiresAt <= Date.now()) {
    await del(key(sectionId, snapshotId));
    return null;
  }

  return record.snapshot;
}

export async function clearCachedWorkspace(sectionId: string, snapshotId: string) {
  await del(key(sectionId, snapshotId));
}
