import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const composePath = resolve(process.cwd(), 'deploy/docker-compose.yml');
const yml = readFileSync(composePath, 'utf8');
describe('deploy/docker-compose.yml', () => {
  it('declares postgres service with the pinned CNB image', () => {
    expect(yml).toMatch(/image:\s+docker\.cnb\.cool\/jaguarliu\.cool\/wenyuan-ai\/docker-sync\/postgres:16-alpine_amd64/);
  });
  it('binds postgres only to 127.0.0.1:55432', () => {
    expect(yml).toMatch(/"127\.0\.0\.1:55432:5432"/);
  });
  it('declares hi-agent-net network and pg-data volume', () => {
    expect(yml).toMatch(/hi-agent-net/);
    expect(yml).toMatch(/pg-data/);
  });
  it('hi-agent service still requires HI_AGENT_IMAGE', () => {
    expect(yml).toMatch(/\$\{HI_AGENT_IMAGE:\?/);
  });
});
