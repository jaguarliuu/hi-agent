import { describe, it, expect } from 'vitest';
import { generateSessionId, buildSetCookie, buildClearCookie } from '@/lib/session';

describe('session token helpers', () => {
  it('generateSessionId returns 43-char base64url string (32 bytes)', () => {
    const sid = generateSessionId();
    expect(sid).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it('buildSetCookie carries HttpOnly + Secure + SameSite=Lax + Max-Age', () => {
    const c = buildSetCookie('abc', { secure: true, ttlSeconds: 2592000 });
    expect(c).toContain('hi_sid=abc');
    expect(c).toContain('HttpOnly');
    expect(c).toContain('Secure');
    expect(c).toContain('SameSite=Lax');
    expect(c).toContain('Path=/');
    expect(c).toContain('Max-Age=2592000');
  });
  it('buildSetCookie omits Secure when secure=false (dev)', () => {
    const c = buildSetCookie('abc', { secure: false, ttlSeconds: 60 });
    expect(c).not.toContain('Secure');
  });
  it('buildClearCookie sets Max-Age=0', () => {
    const c = buildClearCookie({ secure: true });
    expect(c).toContain('Max-Age=0');
    expect(c).toContain('hi_sid=;');
  });
});
