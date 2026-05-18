import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LruCounter } from '@/lib/rate-limit';

describe('LruCounter', () => {
  let c: LruCounter;
  beforeEach(() => {
    vi.useFakeTimers();
    c = new LruCounter({ max: 3 });
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it('increments and returns count within window', () => {
    expect(c.hit('a', 60_000)).toBe(1);
    expect(c.hit('a', 60_000)).toBe(2);
    expect(c.hit('b', 60_000)).toBe(1);
  });
  it('expires entries after window', () => {
    expect(c.hit('a', 100)).toBe(1);
    vi.advanceTimersByTime(150);
    expect(c.hit('a', 100)).toBe(1);
  });
  it('evicts the LRU when over capacity', () => {
    c.hit('a', 60_000);
    c.hit('b', 60_000);
    c.hit('c', 60_000);
    c.hit('d', 60_000);
    expect(c.hit('a', 60_000)).toBe(1);
  });
});
