import { z } from 'zod';

export const GENDERS = ['unknown', 'male', 'female', 'other'] as const;

const BIRTHDAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const customFieldsSchema = z
  .record(z.unknown())
  .refine((v) => JSON.stringify(v).length <= 8 * 1024, {
    message: 'custom_fields exceeds 8KB when serialized'
  });

export const profilePatchSchema = z
  .object({
    display_name: z.string().min(1).max(64).optional(),
    avatar_url: z.string().url().max(512).optional(),
    gender: z.enum(GENDERS).optional(),
    birthday: z
      .string()
      .regex(BIRTHDAY_RE, 'birthday must be YYYY-MM-DD')
      .refine(
        (v) =>
          Number.isFinite(new Date(v).getTime()) &&
          v === new Date(v).toISOString().slice(0, 10),
        { message: 'birthday must be a valid calendar date' }
      )
      .optional(),
    bio: z.string().max(500).optional(),
    locale: z.string().min(2).max(16).optional(),
    timezone: z.string().min(1).max(64).optional(),
    custom_fields: customFieldsSchema.optional()
  })
  .strict();

export type ProfilePatch = z.infer<typeof profilePatchSchema>;

export function mergeCustomFields(
  existing: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown> | undefined
): Record<string, unknown> {
  const base: Record<string, unknown> = { ...(existing ?? {}) };
  if (patch === undefined) return base;
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) {
      delete base[k];
    } else {
      base[k] = v;
    }
  }
  return base;
}

export function asCustomFieldsRecord(
  v: unknown
): Record<string, unknown> | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}
