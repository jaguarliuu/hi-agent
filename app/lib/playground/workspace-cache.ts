import { del, get, set } from 'idb-keyval';

interface CachedWorkspaceRecord {
  snapshot: ArrayBuffer;
  expiresAt: number;
}

function key(sectionId: string) {
  return `playground:${sectionId}`;
}

export async function saveCachedWorkspace(
  sectionId: string,
  snapshot: ArrayBuffer,
  ttlMs: number
) {
  await set(key(sectionId), {
    snapshot,
    expiresAt: Date.now() + ttlMs
  } satisfies CachedWorkspaceRecord);
}

export async function loadCachedWorkspace(sectionId: string) {
  const record = await get<CachedWorkspaceRecord>(key(sectionId));
  if (!record) {
    return null;
  }

  if (record.expiresAt <= Date.now()) {
    await del(key(sectionId));
    return null;
  }

  return record.snapshot;
}

export async function clearCachedWorkspace(sectionId: string) {
  await del(key(sectionId));
}
