import { describe, expect, it } from 'vitest';
import { placeTooltip, tooltipLines, totalTokens } from './token-amount.ts';

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

describe('placeTooltip', () => {
  const size = { width: 200, height: 120 };
  const viewport = { width: 360, height: 640 };
  const anchor = (top: number, left: number) => ({
    top,
    bottom: top + 20,
    left,
    right: left + 40,
  });

  it('puts an "above" tooltip over the anchor, on its right edge', () => {
    expect(
      placeTooltip({
        anchor: anchor(300, 200),
        size: size,
        viewport,
        preferred: 'above',
        margin: 8,
      }),
    ).toEqual({
      side: 'above',
      top: 180,
      left: 40,
    });
  });

  it('puts a "below" tooltip under the anchor, on its left edge', () => {
    expect(
      placeTooltip({
        anchor: anchor(300, 20),
        size: size,
        viewport,
        preferred: 'below',
        margin: 8,
      }),
    ).toEqual({
      side: 'below',
      top: 320,
      left: 20,
    });
  });

  it('flips below when there is no room above', () => {
    expect(
      placeTooltip({
        anchor: anchor(60, 200),
        size: size,
        viewport,
        preferred: 'above',
        margin: 8,
      }).side,
    ).toBe('below');
  });

  it('flips above when there is no room below', () => {
    expect(
      placeTooltip({
        anchor: anchor(560, 20),
        size: size,
        viewport,
        preferred: 'below',
        margin: 8,
      }).side,
    ).toBe('above');
  });

  it('keeps its side when neither side fits', () => {
    const tall = { width: 200, height: 700 };
    expect(
      placeTooltip({
        anchor: anchor(300, 20),
        size: tall,
        viewport,
        preferred: 'above',
        margin: 8,
      }).side,
    ).toBe('above');
  });

  it('keeps the tooltip inside the viewport horizontally', () => {
    expect(
      placeTooltip({
        anchor: anchor(300, 300),
        size: size,
        viewport,
        preferred: 'below',
        margin: 8,
      }).left,
    ).toBe(152);
    expect(
      placeTooltip({
        anchor: anchor(300, 0),
        size: size,
        viewport,
        preferred: 'above',
        margin: 8,
      }).left,
    ).toBe(8);
  });
});
