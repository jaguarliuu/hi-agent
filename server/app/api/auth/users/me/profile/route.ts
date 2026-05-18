import type { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/errors';
import { getAuthedUser } from '@/lib/auth-context';
import {
  profilePatchSchema,
  mergeCustomFields,
  type ProfilePatch
} from '@/lib/profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toApiProfile(p: {
  displayName: string | null;
  avatarUrl: string | null;
  gender: 'unknown' | 'male' | 'female' | 'other';
  birthday: Date | null;
  bio: string | null;
  locale: string;
  timezone: string;
  customFields: unknown;
}) {
  return {
    display_name: p.displayName,
    avatar_url: p.avatarUrl,
    gender: p.gender,
    birthday: p.birthday ? p.birthday.toISOString().slice(0, 10) : null,
    bio: p.bio,
    locale: p.locale,
    timezone: p.timezone,
    custom_fields: p.customFields ?? {}
  };
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuthedUser(req);
  if (!auth) return jsonError('UNAUTHORIZED');
  if (auth.user.status === 'disabled') return jsonError('ACCOUNT_DISABLED');

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError('INVALID_INPUT', { reason: 'invalid_json' });
  }

  const parsed = profilePatchSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError('INVALID_INPUT', { issues: parsed.error.issues });
  }
  const patch: ProfilePatch = parsed.data;

  const existing = await prisma.userProfile.findUnique({
    where: { userId: auth.user.id }
  });

  const existingCf =
    existing && existing.customFields && typeof existing.customFields === 'object'
      ? (existing.customFields as Record<string, unknown>)
      : {};
  const mergedCf = mergeCustomFields(existingCf, patch.custom_fields);
  const mergedCfJson = mergedCf as Prisma.InputJsonValue;

  const birthdayDate =
    patch.birthday !== undefined ? new Date(patch.birthday) : undefined;

  const saved = await prisma.userProfile.upsert({
    where: { userId: auth.user.id },
    update: {
      ...(patch.display_name !== undefined
        ? { displayName: patch.display_name }
        : {}),
      ...(patch.avatar_url !== undefined ? { avatarUrl: patch.avatar_url } : {}),
      ...(patch.gender !== undefined ? { gender: patch.gender } : {}),
      ...(birthdayDate !== undefined ? { birthday: birthdayDate } : {}),
      ...(patch.bio !== undefined ? { bio: patch.bio } : {}),
      ...(patch.locale !== undefined ? { locale: patch.locale } : {}),
      ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
      customFields: mergedCfJson
    },
    create: {
      userId: auth.user.id,
      displayName: patch.display_name ?? null,
      avatarUrl: patch.avatar_url ?? null,
      gender: patch.gender ?? 'unknown',
      birthday: birthdayDate ?? null,
      bio: patch.bio ?? null,
      ...(patch.locale !== undefined ? { locale: patch.locale } : {}),
      ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
      customFields: mergedCfJson
    }
  });

  return jsonOk({ profile: toApiProfile(saved) });
}
