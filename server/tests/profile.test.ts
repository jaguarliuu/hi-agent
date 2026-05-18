import { describe, it, expect } from 'vitest';
import { profilePatchSchema, mergeCustomFields } from '@/lib/profile';

describe('profilePatchSchema', () => {
  it('accepts a fully valid patch', () => {
    const r = profilePatchSchema.safeParse({
      display_name: 'Alice',
      avatar_url: 'https://cdn.example.com/a.png',
      gender: 'female',
      birthday: '1995-06-15',
      bio: 'hello world',
      locale: 'zh-CN',
      timezone: 'Asia/Shanghai',
      custom_fields: { foo: 'bar' }
    });
    expect(r.success).toBe(true);
  });

  it('rejects birthday with bad format', () => {
    const r = profilePatchSchema.safeParse({ birthday: '1995/06/15' });
    expect(r.success).toBe(false);
  });

  it('rejects gender outside enum', () => {
    const r = profilePatchSchema.safeParse({ gender: 'UNKNOWN' });
    expect(r.success).toBe(false);
  });

  it('rejects custom_fields exceeding 8KB serialized', () => {
    const big = 'x'.repeat(9 * 1024);
    const r = profilePatchSchema.safeParse({ custom_fields: { big } });
    expect(r.success).toBe(false);
  });
});

describe('mergeCustomFields', () => {
  it('shallow merges patch over existing', () => {
    const merged = mergeCustomFields({ a: 1, b: 2 }, { b: 99, c: 3 });
    expect(merged).toEqual({ a: 1, b: 99, c: 3 });
  });

  it('deletes a key when patch sets it to null', () => {
    const merged = mergeCustomFields({ a: 1, b: 2 }, { a: null });
    expect(merged).toEqual({ b: 2 });
  });

  it('returns existing untouched when patch is undefined', () => {
    const existing = { a: 1, b: 2 };
    const merged = mergeCustomFields(existing, undefined);
    expect(merged).toEqual({ a: 1, b: 2 });
  });
});
