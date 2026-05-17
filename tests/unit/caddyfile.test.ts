import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { WEBCONTAINER_PATH_PREFIX } from '../../app/lib/playground/runtime-headers.js';

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

function extractBlock(source: string, openRegex: RegExp): string {
  const start = source.search(openRegex);
  if (start < 0) return '';
  const braceStart = source.indexOf('{', start);
  if (braceStart < 0) return '';

  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return source.slice(braceStart, i + 1);
    }
  }
  return '';
}

describe('Caddy deployment headers', () => {
  let caddyfile = '';
  let globalHeaderBlock = '';
  let labsHeaderBlock = '';

  beforeAll(() => {
    caddyfile = readFileSync(resolve(process.cwd(), 'docker/Caddyfile'), 'utf8');

    labsHeaderBlock = extractBlock(caddyfile, /header\s+@webcontainerLabs\s*\{/);

    const sansLabs = caddyfile.replace(labsHeaderBlock, '');
    globalHeaderBlock = extractBlock(sansLabs, /(^|\n)\s*header\s*\{/);
  });

  it('does not leak cross-origin isolation headers into the global header block', () => {
    expect(globalHeaderBlock).not.toBe('');
    expect(globalHeaderBlock).not.toContain('Cross-Origin-Embedder-Policy');
    expect(globalHeaderBlock).not.toContain('Cross-Origin-Opener-Policy');
    expect(globalHeaderBlock).not.toContain('Cross-Origin-Resource-Policy');
  });

  it('declares the @webcontainerLabs matcher with the shared path prefix constant', () => {
    const escaped = escapeRegex(WEBCONTAINER_PATH_PREFIX);
    expect(caddyfile).toMatch(new RegExp(`@webcontainerLabs\\s+path\\s+${escaped}\\*`));
  });

  it('enables cross-origin isolation only inside the @webcontainerLabs block', () => {
    expect(labsHeaderBlock).not.toBe('');
    expect(labsHeaderBlock).toContain('Cross-Origin-Embedder-Policy "require-corp"');
    expect(labsHeaderBlock).toContain('Cross-Origin-Opener-Policy');
    expect(labsHeaderBlock).toMatch(/Cross-Origin-Opener-Policy\s+"same-origin"/);
    expect(labsHeaderBlock).toContain('Cross-Origin-Resource-Policy "cross-origin"');
  });
});
