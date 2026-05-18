import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { jsonError } from '@/lib/errors';
import { hashOtp, getPepper } from '@/lib/otp';
import { checkVerifyAbuse, emailVerifyHit, ipHit } from '@/lib/rate-limit';
import {
  createSession,
  buildSetCookie,
  isSecureCookie,
  getSessionTtlSeconds
} from '@/lib/session';
import { getClientIp } from '@/lib/auth-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  email: z.string().email().max(254).trim().toLowerCase(),
  code: z.string().regex(/^\d{6}$/)
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req) ?? 'unknown';
  if (ipHit(ip) > 100) return jsonError('RATE_LIMITED', { retryAfterSec: 60 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('INVALID_INPUT');
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return jsonError('INVALID_INPUT');
  const { email, code } = parsed.data;
  try {
    if (await checkVerifyAbuse(email)) return jsonError('RATE_LIMITED', { retryAfterSec: 1800 });
    const otp = await prisma.emailOtp.findFirst({
      where: { email, purpose: 'login', consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' }
    });
    if (!otp || otp.attempts >= 5) {
      if (emailVerifyHit(email) > 20) {
        return jsonError('RATE_LIMITED', { retryAfterSec: 1800 });
      }
      return jsonError('INVALID_OR_EXPIRED');
    }
    const expectedHash = hashOtp(code, getPepper());
    const a = Buffer.from(expectedHash, 'hex');
    const b = Buffer.from(otp.codeHash, 'hex');
    const equal = a.length === b.length && timingSafeEqual(a, b);
    if (!equal) {
      await prisma.emailOtp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } }
      });
      return jsonError('INVALID_OR_EXPIRED');
    }
    const userAgent = req.headers.get('user-agent');
    const user = await prisma
      .$transaction(async (tx) => {
        await tx.emailOtp.update({
          where: { id: otp.id },
          data: { consumedAt: new Date() }
        });
        const existing = await tx.user.findUnique({ where: { email } });
        if (existing) {
          if (existing.status === 'disabled') {
            throw Object.assign(new Error('disabled'), { code: 'ACCOUNT_DISABLED' });
          }
          return tx.user.update({
            where: { id: existing.id },
            data: {
              emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
              lastLoginAt: new Date(),
              lastLoginIp: ip === 'unknown' ? null : ip,
              lastLoginUa: userAgent ?? null,
              loginCount: { increment: 1 },
              failedLoginCount: 0
            }
          });
        }
        const created = await tx.user.create({
          data: {
            email,
            status: 'active',
            emailVerifiedAt: new Date(),
            lastLoginAt: new Date(),
            lastLoginIp: ip === 'unknown' ? null : ip,
            lastLoginUa: userAgent ?? null,
            loginCount: 1
          }
        });
        await tx.userProfile.create({
          data: {
            userId: created.id,
            displayName: email.split('@')[0]!.slice(0, 32)
          }
        });
        return created;
      })
      .catch((err: { code?: string }) => {
        if (err?.code === 'ACCOUNT_DISABLED') return null;
        if (err?.code === 'P2002') return 'P2002' as const;
        throw err;
      });
    if (user === null) return jsonError('ACCOUNT_DISABLED');
    if (user === 'P2002') return jsonError('INVALID_OR_EXPIRED');
    const { id: sid } = await createSession({
      userId: user.id,
      ip: ip === 'unknown' ? null : ip,
      userAgent
    });
    const cookie = buildSetCookie(sid, {
      secure: isSecureCookie(),
      ttlSeconds: getSessionTtlSeconds()
    });
    return new NextResponse(
      JSON.stringify({ ok: true, user: { id: user.id, email: user.email } }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookie }
      }
    );
  } catch (err) {
    console.error('[otp/verify] internal error', String(err));
    return jsonError('INTERNAL');
  }
}
