import { createHash, randomInt } from 'node:crypto';

export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashOtp(code: string, pepper: string): string {
  return createHash('sha256').update(`${code}|${pepper}`).digest('hex');
}

export function getPepper(): string {
  const p = process.env.OTP_PEPPER;
  if (!p) throw new Error('OTP_PEPPER is not set');
  return p;
}
