import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as githubStart } from '@/app/api/auth/oauth/github/start/route';
import { GET as githubCallback } from '@/app/api/auth/oauth/github/callback/route';
import { GET as wechatStart } from '@/app/api/auth/oauth/wechat/start/route';
import { GET as wechatCallback } from '@/app/api/auth/oauth/wechat/callback/route';

const stubs: Array<{
  name: string;
  handler: (req: NextRequest) => Promise<Response>;
  url: string;
  provider: string;
  stage: string;
}> = [
  {
    name: 'GET /api/auth/oauth/github/start',
    handler: githubStart,
    url: 'http://localhost/api/auth/oauth/github/start',
    provider: 'github',
    stage: 'start'
  },
  {
    name: 'GET /api/auth/oauth/github/callback',
    handler: githubCallback,
    url: 'http://localhost/api/auth/oauth/github/callback',
    provider: 'github',
    stage: 'callback'
  },
  {
    name: 'GET /api/auth/oauth/wechat/start',
    handler: wechatStart,
    url: 'http://localhost/api/auth/oauth/wechat/start',
    provider: 'wechat',
    stage: 'start'
  },
  {
    name: 'GET /api/auth/oauth/wechat/callback',
    handler: wechatCallback,
    url: 'http://localhost/api/auth/oauth/wechat/callback',
    provider: 'wechat',
    stage: 'callback'
  }
];

describe('oauth provider stubs return 501 NOT_IMPLEMENTED', () => {
  for (const s of stubs) {
    it(s.name, async () => {
      const res = await s.handler(new NextRequest(s.url));
      expect(res.status).toBe(501);
      const body = await res.json();
      expect(body.code).toBe('NOT_IMPLEMENTED');
      expect(body.provider).toBe(s.provider);
      expect(body.stage).toBe(s.stage);
    });
  }
});
