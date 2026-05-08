import { describe, expect, it } from 'vitest';
import {
  WEBCONTAINER_HEADERS,
  getWebcontainerHeaderEntries
} from '@/app/lib/playground/runtime-headers';

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
});
