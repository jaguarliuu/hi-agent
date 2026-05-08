import { describe, expect, it } from 'vitest';
import { findAnchorPosition } from '@/app/lib/playground/anchor-locator';

describe('findAnchorPosition', () => {
  it('returns the line index for an anchor comment', () => {
    const result = findAnchorPosition(
      ['line one', '// @anchor:main-entry', 'line three'].join('\n'),
      '@anchor:main-entry'
    );

    expect(result).toEqual({ lineNumber: 2, column: 1 });
  });
});
