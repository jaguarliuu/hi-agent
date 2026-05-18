import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { PATCH } from '@/app/api/auth/users/me/profile/route';

function makeReq(body: unknown, opts: { cookie?: string } = {}) {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (opts.cookie) headers.set('cookie', opts.cookie);
  return new NextRequest('http://localhost/api/auth/users/me/profile', {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body)
  });
}

describe('PATCH /api/auth/users/me/profile', () => {
  it('returns 401 when no session cookie', async () => {
    const res = await PATCH(makeReq({ display_name: 'x' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  // TODO(PR-5.5 或后续 PR)：以下 200 / 400 fixture 用例需要 server/tests/setup.ts
  // 在 beforeAll 真实插入 user + session 行才能跑通；当前 PR 是骨架，
  // 不引入"假 cookie 短路"以避免污染生产代码。
  //
  // it('returns 200 and merges custom_fields shallowly', async () => { ... });
  // it('returns 400 for invalid_json body', async () => { ... });
  // it('returns 400 with issues for schema validation failure', async () => { ... });
});
