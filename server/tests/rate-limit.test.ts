import { describe, it, expect, beforeEach } from 'vitest';
import { LruCounter } from '@/lib/rate-limit';

describe('LruCounter', () => {
  let c: LruCounter;
  beforeEach(() => {
    c = new LruCounter({ max: 3 });
  });
  it('increments and returns count within window', () => {
    expect(c.hit('a', 60_000)).toBe(1);
    expect(c.hit('a', 60_000)).toBe(2);
    expect(c.hit('b', 60_000)).toBe(1);
  });
  it('expires entries after window', () => {
    c.hit('a', 1);
    return new Promise<void>((resolve) =>
      setTimeout(() => {
        expect(c.hit('a', 1)).toBe(1);
        resolve();
      }, 5)
    );
  });
  it('evicts the LRU when over capacity', () => {
    c.hit('a', 60_000);
    c.hit('b', 60_000);
    c.hit('c', 60_000);
    c.hit('d', 60_000);
    expect(c.hit('a', 60_000)).toBe(1);
  });
});
