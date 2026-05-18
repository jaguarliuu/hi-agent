import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/errors';
import { getAuthedUser } from '@/lib/auth-context';
import { hashPassword, verifyPassword, passwordSchema } from '@/lib/password';
import { revokeOtherSessions } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  current_password: z.string().min(1).max(128),
  new_password: passwordSchema
});

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

  const row = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { passwordHash: true }
  });
  if (!row?.passwordHash) {
    return jsonError('FORBIDDEN', { reason: 'password_not_set' });
  }

  const ok = await verifyPassword(row.passwordHash, parsed.data.current_password);
  if (!ok) {
    return jsonError('UNAUTHORIZED', { reason: 'wrong_current_password' });
  }

  const hash = await hashPassword(parsed.data.new_password);
  await prisma.user.update({
    where: { id: auth.user.id },
    data: { passwordHash: hash, passwordUpdatedAt: new Date() }
  });

  await revokeOtherSessions(auth.user.id, auth.sid);

  return jsonOk({});
}
