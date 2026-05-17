import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { WEBCONTAINER_PATH_PREFIXES } from '../../app/lib/playground/runtime-headers.js';

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
  let webcontainerHeaderBlock = '';

  beforeAll(() => {
    caddyfile = readFileSync(resolve(process.cwd(), 'docker/Caddyfile'), 'utf8');

    webcontainerHeaderBlock = extractBlock(caddyfile, /header\s+@webcontainerPages\s*\{/);

    const sansWebcontainer = caddyfile.replace(webcontainerHeaderBlock, '');
    globalHeaderBlock = extractBlock(sansWebcontainer, /(^|\n)\s*header\s*\{/);
  });

  it('does not leak cross-origin isolation headers into the global header block', () => {
    expect(globalHeaderBlock).not.toBe('');
    expect(globalHeaderBlock).not.toContain('Cross-Origin-Embedder-Policy');
    expect(globalHeaderBlock).not.toContain('Cross-Origin-Opener-Policy');
    expect(globalHeaderBlock).not.toContain('Cross-Origin-Resource-Policy');
  });

  it('declares the @webcontainerPages matcher with the shared path prefixes', () => {
    expect(caddyfile).toMatch(/@webcontainerPages\s+path/);
    for (const prefix of WEBCONTAINER_PATH_PREFIXES) {
      const pattern = prefix.endsWith('/') ? `${prefix}*` : prefix;
      expect(caddyfile).toMatch(new RegExp(escapeRegex(pattern)));
    }
    expect(caddyfile).toContain('/courses/hi-agent/chat/01-getting-started/*');
  });

  it('enables cross-origin isolation only inside the @webcontainerPages block', () => {
    expect(webcontainerHeaderBlock).not.toBe('');
    expect(webcontainerHeaderBlock).toContain('Cross-Origin-Embedder-Policy "require-corp"');
    expect(webcontainerHeaderBlock).toContain('Cross-Origin-Opener-Policy');
    expect(webcontainerHeaderBlock).toMatch(/Cross-Origin-Opener-Policy\s+"same-origin"/);
    expect(webcontainerHeaderBlock).toContain('Cross-Origin-Resource-Policy "cross-origin"');
  });
});
