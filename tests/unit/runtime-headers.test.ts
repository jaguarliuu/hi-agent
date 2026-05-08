import { describe, expect, it } from 'vitest';
import * as runtimeHeadersModule from '@/app/lib/playground/runtime-headers.js';

const runtimeHeaders =
  'default' in runtimeHeadersModule
    ? runtimeHeadersModule.default
    : runtimeHeadersModule;

const {
  WEBCONTAINER_HEADERS,
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

  it('maps the headers to a Next.js headers() entry', () => {
    expect(getWebcontainerHeaderEntries()).toEqual([
      {
        source: '/:path*',
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
