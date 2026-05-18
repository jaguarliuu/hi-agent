import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/errors';
import { generateOtpCode, hashOtp, getPepper } from '@/lib/otp';
import { checkEmailOtpQuota, ipHit } from '@/lib/rate-limit';
import { sendOtpEmail } from '@/lib/mailer';
import { getClientIp } from '@/lib/auth-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  email: z.string().email().max(254).trim().toLowerCase()
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
  const email = parsed.data.email;
  const quota = await checkEmailOtpQuota(email);
  if (quota) return jsonError('RATE_LIMITED', { retryAfterSec: quota.retryAfterSec });
  const code = generateOtpCode();
  const codeHash = hashOtp(code, getPepper());
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.emailOtp.create({
    data: {
      email,
      codeHash,
      purpose: 'login',
      expiresAt,
      requestIp: ip === 'unknown' ? null : ip
    }
  });
  sendOtpEmail(email, code).catch((err) => {
    const domain = email.split('@')[1] ?? 'unknown';
    console.error('[mailer] send failed', { domain, err: String(err) });
  });
  return jsonOk({});
}
