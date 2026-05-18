import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db';

export const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'hi_sid';

export function getSessionTtlSeconds(): number {
  const days = Number(process.env.SESSION_TTL_DAYS || '30');
  return days * 24 * 60 * 60;
}

export function isSecureCookie(): boolean {
  return process.env.SECURE_COOKIE !== 'false';
}

export function generateSessionId(): string {
  return randomBytes(32).toString('base64url');
}

export interface CookieOpts {
  secure: boolean;
  ttlSeconds: number;
}

export function buildSetCookie(sid: string, opts: CookieOpts): string {
  const parts = [
    `${COOKIE_NAME}=${sid}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${opts.ttlSeconds}`
  ];
  if (opts.secure) parts.splice(2, 0, 'Secure');
  return parts.join('; ');
}

export function buildClearCookie(opts: { secure: boolean }): string {
  const parts = [`${COOKIE_NAME}=`, 'HttpOnly', 'Path=/', 'SameSite=Lax', 'Max-Age=0'];
  if (opts.secure) parts.splice(2, 0, 'Secure');
  return parts.join('; ');
}

export async function createSession(args: {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<{ id: string; expiresAt: Date }> {
  const id = generateSessionId();
  const ttlMs = getSessionTtlSeconds() * 1000;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);
  await prisma.session.create({
    data: {
      id,
      userId: args.userId,
      expiresAt,
      lastSeenAt: now,
      ip: args.ip ?? null,
      userAgent: args.userAgent ?? null
    }
  });
  return { id, expiresAt };
}

export async function touchSession(sid: string) {
  const row = await prisma.session.findUnique({ where: { id: sid } });
  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  if (Date.now() - row.lastSeenAt.getTime() > 60_000) {
    await prisma.session.update({
      where: { id: sid },
      data: { lastSeenAt: new Date() }
    });
  }
  return row;
}

export async function revokeSession(sid: string) {
  await prisma.session.updateMany({
    where: { id: sid, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}

export async function revokeOtherSessions(userId: string, keepSid: string) {
  await prisma.session.updateMany({
    where: { userId, id: { not: keepSid }, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}
