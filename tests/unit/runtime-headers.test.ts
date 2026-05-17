import { describe, expect, it } from 'vitest';
import * as runtimeHeadersModule from '@/app/lib/playground/runtime-headers.js';

const runtimeHeaders =
  'default' in runtimeHeadersModule
    ? runtimeHeadersModule.default
    : runtimeHeadersModule;

const {
  WEBCONTAINER_HEADERS,
  WEBCONTAINER_PATH_PREFIX,
  WEBCONTAINER_NEXT_SOURCE,
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

  it('exposes a single source of truth for the WebContainer path prefix', () => {
    expect(WEBCONTAINER_PATH_PREFIX).toBe('/courses/hi-agent/labs/');
    expect(WEBCONTAINER_NEXT_SOURCE).toBe(`${WEBCONTAINER_PATH_PREFIX}:path*`);
  });

  it('scopes the Next.js headers() entry strictly to the labs route prefix', () => {
    expect(getWebcontainerHeaderEntries()).toEqual([
      {
        source: WEBCONTAINER_NEXT_SOURCE,
        headers: WEBCONTAINER_HEADERS
      }
    ]);
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
