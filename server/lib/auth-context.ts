import type { NextRequest } from 'next/server';
import { COOKIE_NAME, touchSession } from '@/lib/session';
import { prisma } from '@/lib/db';

export interface AuthedUser {
  id: string;
  email: string;
  status: 'pending' | 'active' | 'disabled' | 'deleted';
  role: 'user' | 'editor' | 'admin' | 'superadmin';
}

export async function getAuthedUser(req: NextRequest): Promise<{
  sid: string;
  user: AuthedUser;
} | null> {
  const sid = req.cookies.get(COOKIE_NAME)?.value;
  if (!sid) return null;
  const session = await touchSession(sid);
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, status: true, role: true }
  });
  if (!user || user.status === 'deleted') return null;
  return { sid, user };
}

export function getClientIp(req: NextRequest): string | null {
  const trust = process.env.TRUST_PROXY;
  if (trust !== 'true' && trust !== '1') return null;
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() ?? null;
  return req.headers.get('x-real-ip');
}
