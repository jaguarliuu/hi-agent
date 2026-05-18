import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// vitest 默认 jsdom 环境下 import.meta.url 不是 file://，因此用 cwd 解析。
// vitest 的工作目录始终是项目根。
const path = resolve(process.cwd(), 'next.config.mjs');
const src = readFileSync(path, 'utf8');

describe('next.config.mjs (post GH-Pages)', () => {
  it('does not reference GITHUB_PAGES anymore', () => {
    expect(src).not.toMatch(/GITHUB_PAGES/);
  });
  it('does not declare a non-empty basePath', () => {
    expect(src).not.toMatch(/basePath:\s*`?\//);
  });
  it('keeps output: export for production builds', () => {
    expect(src).toMatch(/output:\s*'export'/);
  });
});
