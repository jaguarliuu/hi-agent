import { describe, it, expect } from 'vitest';
import { generateOtpCode, hashOtp } from '@/lib/otp';

describe('otp helpers', () => {
  it('generateOtpCode produces 6 digits', () => {
    for (let i = 0; i < 50; i++) {
      const c = generateOtpCode();
      expect(c).toMatch(/^\d{6}$/);
    }
  });
  it('hashOtp is deterministic for same code+pepper', () => {
    expect(hashOtp('123456', 'pepper')).toBe(hashOtp('123456', 'pepper'));
  });
  it('hashOtp differs when pepper changes', () => {
    expect(hashOtp('123456', 'p1')).not.toBe(hashOtp('123456', 'p2'));
  });
});
