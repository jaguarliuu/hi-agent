import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { jsonError } from '@/lib/errors';
import { getAuthedUser } from '@/lib/auth-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ctx = await getAuthedUser(req);
  if (!ctx) return jsonError('UNAUTHORIZED');
  if (ctx.user.status === 'disabled') return jsonError('ACCOUNT_DISABLED');
  const profile = await prisma.userProfile.findUnique({ where: { userId: ctx.user.id } });
  return NextResponse.json({
    ok: true,
    user: {
      id: ctx.user.id,
      email: ctx.user.email,
      role: ctx.user.role,
      profile: profile
        ? {
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            bio: profile.bio,
            locale: profile.locale,
            timezone: profile.timezone,
            customFields: profile.customFields
          }
        : null
    }
  });
}
