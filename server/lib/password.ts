import argon2 from 'argon2';
import { z } from 'zod';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
} as const;

export const passwordSchema = z
  .string()
  .min(8, 'password must be at least 8 chars')
  .max(128, 'password must be at most 128 chars')
  .refine((v) => /[a-z]/.test(v), 'password must contain a lowercase letter')
  .refine((v) => /[A-Z]/.test(v), 'password must contain an uppercase letter')
  .refine((v) => /\d/.test(v), 'password must contain a digit');

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(
  hash: string,
  plain: string
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
