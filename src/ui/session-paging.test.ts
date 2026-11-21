import { describe, expect, it } from 'vitest';
import { canShowMore, nextLimit } from './session-paging.ts';

describe('session paging', () => {
  it('adds 50 rows at a time up to 500, never beyond', () => {
    const limits = [50];
    while (canShowMore(limits.at(-1) ?? 0, 600)) {
      limits.push(nextLimit(limits.at(-1) ?? 0));
    }
    expect(limits).toEqual([50, 100, 150, 200, 250, 300, 350, 400, 450, 500]);
    expect(nextLimit(500)).toBe(500);
  });

  it('offers Show more only while rows remain below the cap', () => {
    expect(canShowMore(450, 600)).toBe(true);
    expect(canShowMore(500, 600)).toBe(false);
    expect(canShowMore(75, 75)).toBe(false);
  });
});
