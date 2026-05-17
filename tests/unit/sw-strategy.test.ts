import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  STRATEGY,
  decideStrategy,
  isWebcontainerPath
} from '../../app/lib/pwa/sw-strategy.js';

const ORIGIN = 'https://hi-agent.example.com';

function url(path: string): string {
  return `${ORIGIN}${path}`;
}

describe('Service Worker · routing strategy', () => {
  it('passes through non-GET requests', () => {
    expect(
      decideStrategy({
        method: 'POST',
        requestUrl: url('/anything'),
        selfOrigin: ORIGIN
      })
    ).toBe(STRATEGY.PASS_THROUGH);
  });

  it('passes through cross-origin requests (giscus / GitHub / fonts)', () => {
    for (const cross of [
      'https://giscus.app/api/discussions',
      'https://avatars.githubusercontent.com/u/1?v=4',
      'https://fonts.gstatic.com/s/inter.woff2'
    ]) {
      expect(
        decideStrategy({
          method: 'GET',
          requestUrl: cross,
          selfOrigin: ORIGIN
        })
      ).toBe(STRATEGY.PASS_THROUGH);
    }
  });

  it('forces network-only for WebContainer pages so COOP/COEP are preserved', () => {
    const labsRoot = decideStrategy({
      method: 'GET',
      requestUrl: url('/courses/hi-agent/labs/01-webcontainers-pilot/'),
      selfOrigin: ORIGIN
    });
    expect(labsRoot).toBe(STRATEGY.NETWORK_ONLY);

    const chatExact = decideStrategy({
      method: 'GET',
      requestUrl: url('/courses/hi-agent/chat/01-getting-started'),
      selfOrigin: ORIGIN
    });
    expect(chatExact).toBe(STRATEGY.NETWORK_ONLY);

    const chatTrailing = decideStrategy({
      method: 'GET',
      requestUrl: url('/courses/hi-agent/chat/01-getting-started/'),
      selfOrigin: ORIGIN
    });
    expect(chatTrailing).toBe(STRATEGY.NETWORK_ONLY);
  });

  it('caches snapshots and Next static chunks aggressively', () => {
    expect(
      decideStrategy({
        method: 'GET',
        requestUrl: url('/webcontainer-snapshots/chat-01-getting-started.bin'),
        selfOrigin: ORIGIN
      })
    ).toBe(STRATEGY.CACHE_FIRST);

    expect(
      decideStrategy({
        method: 'GET',
        requestUrl: url('/_next/static/chunks/abc.js'),
        selfOrigin: ORIGIN
      })
    ).toBe(STRATEGY.CACHE_FIRST);

    expect(
      decideStrategy({
        method: 'GET',
        requestUrl: url('/icons/icon.svg'),
        selfOrigin: ORIGIN
      })
    ).toBe(STRATEGY.CACHE_FIRST);
  });

  it('uses stale-while-revalidate for course HTML, manifest and Pagefind', () => {
    expect(
      decideStrategy({
        method: 'GET',
        requestUrl: url('/courses/hi-agent/begin/01-ai-language/'),
        selfOrigin: ORIGIN
      })
    ).toBe(STRATEGY.STALE_WHILE_REVALIDATE);

    expect(
      decideStrategy({
        method: 'GET',
        requestUrl: url('/manifest.webmanifest'),
        selfOrigin: ORIGIN
      })
    ).toBe(STRATEGY.STALE_WHILE_REVALIDATE);

    expect(
      decideStrategy({
        method: 'GET',
        requestUrl: url('/_pagefind/pagefind.js'),
        selfOrigin: ORIGIN
      })
    ).toBe(STRATEGY.STALE_WHILE_REVALIDATE);
  });

  it('respects basePath when deployed under /hi-agent (GitHub Pages)', () => {
    const cross = decideStrategy({
      method: 'GET',
      requestUrl: url('/hi-agent/courses/hi-agent/labs/01-webcontainers-pilot/'),
      selfOrigin: ORIGIN,
      basePath: '/hi-agent'
    });
    expect(cross).toBe(STRATEGY.NETWORK_ONLY);

    const snapshot = decideStrategy({
      method: 'GET',
      requestUrl: url('/hi-agent/webcontainer-snapshots/labs-01.bin'),
      selfOrigin: ORIGIN,
      basePath: '/hi-agent'
    });
    expect(snapshot).toBe(STRATEGY.CACHE_FIRST);
  });

  it('isWebcontainerPath matches the documented prefixes', () => {
    expect(isWebcontainerPath('/courses/hi-agent/labs/01-webcontainers-pilot/')).toBe(true);
    expect(isWebcontainerPath('/courses/hi-agent/chat/01-getting-started')).toBe(true);
    expect(isWebcontainerPath('/courses/hi-agent/chat/01-getting-started/setup')).toBe(true);
    expect(isWebcontainerPath('/courses/hi-agent/chat/02-other')).toBe(false);
    expect(isWebcontainerPath('/courses/hi-agent/begin/01-ai-language/')).toBe(false);
  });
});

describe('Service Worker · sw.js stays in sync with sw-strategy.js', () => {
  it('embeds the same WebContainer path prefixes', () => {
    const sw = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8');
    expect(sw).toContain("'/courses/hi-agent/labs/'");
    expect(sw).toContain("'/courses/hi-agent/chat/01-getting-started'");
    expect(sw).toContain("/webcontainer-snapshots/");
    expect(sw).toContain('NETWORK_ONLY');
    expect(sw).toContain('CACHE_FIRST');
    expect(sw).toContain('STALE_WHILE_REVALIDATE');
  });

  it('declares a finite SW_VERSION so the activate hook can prune old caches', () => {
    const sw = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8');
    expect(sw).toMatch(/SW_VERSION\s*=\s*'[^']+'/);
  });
});
