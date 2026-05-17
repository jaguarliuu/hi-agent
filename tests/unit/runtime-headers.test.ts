import { describe, expect, it } from 'vitest';
import * as runtimeHeadersModule from '@/app/lib/playground/runtime-headers.js';

const runtimeHeaders =
  'default' in runtimeHeadersModule
    ? runtimeHeadersModule.default
    : runtimeHeadersModule;

const {
  WEBCONTAINER_HEADERS,
  WEBCONTAINER_PATH_PREFIXES,
  WEBCONTAINER_NEXT_SOURCES,
  getWebcontainerHeaderEntries,
  shouldEnableWebcontainerHeaders
} = runtimeHeaders;

describe('runtime headers', () => {
  it('exposes the required COOP and COEP headers', () => {
    expect(WEBCONTAINER_HEADERS).toEqual([
      { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' }
    ]);
  });

  it('exposes a single source of truth for WebContainer path prefixes', () => {
    expect(WEBCONTAINER_PATH_PREFIXES).toEqual([
      '/courses/hi-agent/labs/',
      '/courses/hi-agent/chat/01-getting-started'
    ]);
    expect(WEBCONTAINER_NEXT_SOURCES).toEqual([
      '/courses/hi-agent/labs/:path*',
      '/courses/hi-agent/chat/01-getting-started',
      '/courses/hi-agent/chat/01-getting-started/:path*'
    ]);
  });

  it('scopes the Next.js headers() entries strictly to WebContainer routes', () => {
    expect(getWebcontainerHeaderEntries()).toEqual(
      WEBCONTAINER_NEXT_SOURCES.map((source: string) => ({
        source,
        headers: WEBCONTAINER_HEADERS
      }))
    );
  });

  it('enables runtime headers in development', () => {
    expect(
      shouldEnableWebcontainerHeaders({
        nodeEnv: 'development',
        enableRuntimeHeaders: false
      })
    ).toBe(true);
  });

  it('allows opting into runtime headers outside development', () => {
    expect(
      shouldEnableWebcontainerHeaders({
        nodeEnv: 'production',
        enableRuntimeHeaders: true
      })
    ).toBe(true);
  });

  it('disables runtime headers for the default production export path', () => {
    expect(
      shouldEnableWebcontainerHeaders({
        nodeEnv: 'production',
        enableRuntimeHeaders: false
      })
    ).toBe(false);
  });
});
