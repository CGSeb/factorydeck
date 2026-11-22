import { describe, expect, it } from 'vitest';
import { shiftIntoView, tooltipLines, totalTokens } from './token-amount.ts';

const COUNTS = {
  input: 1_200,
  output: 950,
  cacheRead: 41_800_000,
  cacheWrite: 320_000,
};

function texts(lines: ReturnType<typeof tooltipLines>): string[] {
  return lines.map((line) =>
    line.kind === 'note' ? line.text : `${line.label} ${line.value}`,
  );
}

describe('totalTokens', () => {
  it('sums the four counts', () => {
    expect(totalTokens(COUNTS)).toBe(42_122_150);
  });

  it('is 0 when every count is 0', () => {
    expect(
      totalTokens({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }),
    ).toBe(0);
  });
});

describe('tooltipLines', () => {
  it('lists the cost, then the four counts', () => {
    expect(texts(tooltipLines(COUNTS, 27.4))).toEqual([
      'Cost ~$27.40',
      'Input 1.2K',
      'Output 950',
      'Cache read 41.8M',
      'Cache write 320.0K',
    ]);
  });

  it('shows a cost under one cent as <$0.01', () => {
    expect(texts(tooltipLines(COUNTS, 0.004))[0]).toBe('Cost <$0.01');
  });

  it('says the price is unknown for every call when the cost is null', () => {
    expect(texts(tooltipLines(COUNTS, null, 3)).slice(0, 3)).toEqual([
      'Cost —',
      'Price unknown for every call',
      'Input 1.2K',
    ]);
  });

  it('names one call with an unknown price in the singular', () => {
    expect(texts(tooltipLines(COUNTS, 27.4, 1)).slice(0, 2)).toEqual([
      'Cost ~$27.40',
      'Excludes 1 call with unknown price',
    ]);
  });

  it('names several calls with an unknown price in the plural', () => {
    expect(texts(tooltipLines(COUNTS, 27.4, 2))[1]).toBe(
      'Excludes 2 calls with unknown price',
    );
  });

  it('adds no note when every price is known', () => {
    expect(tooltipLines(COUNTS, 27.4, 0)).toHaveLength(5);
  });

  it('shows zero counts as 0', () => {
    expect(
      texts(
        tooltipLines({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, 0),
      ),
    ).toEqual([
      'Cost ~$0.00',
      'Input 0',
      'Output 0',
      'Cache read 0',
      'Cache write 0',
    ]);
  });
});

describe('shiftIntoView', () => {
  it('leaves a box inside the viewport in place', () => {
    expect(shiftIntoView({ left: 20, right: 220 }, 360, 8)).toBe(0);
  });

  it('shifts a box past the right edge to the left', () => {
    expect(shiftIntoView({ left: 300, right: 500 }, 360, 8)).toBe(-148);
  });

  it('shifts a box past the left edge to the right', () => {
    expect(shiftIntoView({ left: -40, right: 160 }, 360, 8)).toBe(48);
  });

  it('keeps the left edge visible when the box is wider than the viewport', () => {
    expect(shiftIntoView({ left: 100, right: 500 }, 360, 8)).toBe(-92);
  });
});
