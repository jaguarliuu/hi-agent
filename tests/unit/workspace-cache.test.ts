import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearCachedWorkspace,
  loadCachedWorkspace,
  saveCachedWorkspace
} from '@/app/lib/playground/workspace-cache';

describe('workspace cache', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-05-08T12:00:00Z'));
    await clearCachedWorkspace('labs-01-webcontainers-pilot', 'labs-01-webcontainers-pilot-v1');
    await clearCachedWorkspace('labs-01-webcontainers-pilot', 'labs-01-webcontainers-pilot-v2');
  });

  afterEach(async () => {
    await clearCachedWorkspace('labs-01-webcontainers-pilot', 'labs-01-webcontainers-pilot-v1');
    await clearCachedWorkspace('labs-01-webcontainers-pilot', 'labs-01-webcontainers-pilot-v2');
    vi.useRealTimers();
  });

  it('returns null after the TTL expires', async () => {
    await saveCachedWorkspace(
      'labs-01-webcontainers-pilot',
      'labs-01-webcontainers-pilot-v1',
      new Uint8Array([1, 2, 3]).buffer,
      1000
    );
    vi.advanceTimersByTime(1001);

    await expect(
      loadCachedWorkspace('labs-01-webcontainers-pilot', 'labs-01-webcontainers-pilot-v1')
    ).resolves.toBeNull();
  });

  it('treats different snapshot versions as different cache entries', async () => {
    await saveCachedWorkspace(
      'labs-01-webcontainers-pilot',
      'labs-01-webcontainers-pilot-v1',
      new Uint8Array([1, 2, 3]).buffer,
      1000
    );

    await expect(
      loadCachedWorkspace('labs-01-webcontainers-pilot', 'labs-01-webcontainers-pilot-v2')
    ).resolves.toBeNull();
  });
});
