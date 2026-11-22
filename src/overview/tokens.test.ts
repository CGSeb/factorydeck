import { describe, expect, it } from 'vitest';
import { roundCounts, totalTokens, withTokenCounts } from './tokens.ts';

describe('roundCounts', () => {
  it('keeps whole counts as they are', () => {
    expect(
      roundCounts({ input: 1, cacheWrite: 2, cacheRead: 3, output: 4 }),
    ).toEqual({ input: 1, cacheWrite: 2, cacheRead: 3, output: 4 });
  });

  it('gives the rounding difference to the largest count', () => {
    expect(
      roundCounts({
        input: 0.4,
        cacheWrite: 0.4,
        cacheRead: 100.4,
        output: 0.4,
      }),
    ).toEqual({ input: 0, cacheWrite: 0, cacheRead: 102, output: 0 });
  });

  it('never makes a count negative when it takes the difference back', () => {
    const counts = roundCounts({
      input: 0.5,
      cacheWrite: 0.5,
      cacheRead: 0.5,
      output: 0.5,
    });
    expect(totalTokens(counts)).toBe(2);
    expect(Object.values(counts).every((count) => count >= 0)).toBe(true);
  });
});

describe('withTokenCounts', () => {
  it('sets tokens to the sum of the rounded counts', () => {
    expect(
      withTokenCounts(
        { tokens: 8.571 },
        { input: 6 / 7, cacheWrite: 12 / 7, cacheRead: 18 / 7, output: 24 / 7 },
      ),
    ).toEqual({
      tokens: 9,
      tokenCounts: { input: 1, cacheWrite: 2, cacheRead: 3, output: 3 },
    });
  });
});
