import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import {
  hashPassword,
  verifyPassword,
  passwordSchema
} from '@/lib/password';
import { POST as setPOST } from '@/app/api/auth/password/set/route';
import { POST as changePOST } from '@/app/api/auth/password/change/route';

describe('password lib', () => {
  it('hashes and verifies a strong password', async () => {
    const pw = 'Strong1Password';
    const hash = await hashPassword(pw);
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, pw)).toBe(true);
    expect(await verifyPassword(hash, 'wrong-Password1')).toBe(false);
  });

  it('passwordSchema rejects short or weak passwords', () => {
    expect(passwordSchema.safeParse('short1A').success).toBe(false);
    expect(passwordSchema.safeParse('alllowercase1').success).toBe(false);
    expect(passwordSchema.safeParse('ALLUPPERCASE1').success).toBe(false);
    expect(passwordSchema.safeParse('NoDigitsHere').success).toBe(false);
    expect(passwordSchema.safeParse('Strong1Password').success).toBe(true);
  });
});

function makeReq(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

describe('POST /api/auth/password/set', () => {
  it('returns 401 when no session cookie', async () => {
    const res = await setPOST(
      makeReq('/api/auth/password/set', { password: 'Strong1Password' })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  // TODO(后续 PR)：200 / 403 password_already_set / 400 fixture 用例需要 setup.ts 注入登录态。
});

describe('POST /api/auth/password/change', () => {
  it('returns 401 when no session cookie', async () => {
    const res = await changePOST(
      makeReq('/api/auth/password/change', {
        current_password: 'Old1Password',
        new_password: 'New1Password'
      })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  // TODO(后续 PR)：403 password_not_set / 401 wrong_current_password / 200 + revokeOtherSessions
  // 用例需要 setup.ts 注入登录态。
});
