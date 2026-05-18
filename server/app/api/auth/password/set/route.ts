import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/errors';
import { getAuthedUser } from '@/lib/auth-context';
import { hashPassword, passwordSchema } from '@/lib/password';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({ password: passwordSchema });

export async function POST(req: NextRequest) {
  const auth = await getAuthedUser(req);
  if (!auth) return jsonError('UNAUTHORIZED');
  if (auth.user.status === 'disabled') return jsonError('ACCOUNT_DISABLED');

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError('INVALID_INPUT', { reason: 'invalid_json' });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError('INVALID_INPUT', { issues: parsed.error.issues });
  }

  const existing = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { passwordHash: true }
  });
  if (existing?.passwordHash) {
    return jsonError('FORBIDDEN', { reason: 'password_already_set' });
  }

  const hash = await hashPassword(parsed.data.password);
  await prisma.user.update({
    where: { id: auth.user.id },
    data: { passwordHash: hash, passwordUpdatedAt: new Date() }
  });

  return jsonOk({});
}
