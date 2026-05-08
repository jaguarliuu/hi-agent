import { describe, expect, it } from 'vitest';
import {
  initialPlaygroundState,
  playgroundReducer
} from '@/app/lib/playground/playground-state';

describe('playgroundReducer', () => {
  it('moves from idle to ready after boot and mount', () => {
    const booting = playgroundReducer(initialPlaygroundState, {
      type: 'BOOT_STARTED',
      sectionId: 'labs-01-webcontainers-pilot'
    });
    const ready = playgroundReducer(booting, {
      type: 'WORKSPACE_READY',
      sectionId: 'labs-01-webcontainers-pilot',
      activeFile: 'src/main.ts'
    });

    expect(ready.status).toBe('ready');
    expect(ready.sectionId).toBe('labs-01-webcontainers-pilot');
    expect(ready.activeFile).toBe('src/main.ts');
  });
});
