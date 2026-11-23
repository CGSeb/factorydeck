import { describe, expect, it } from 'vitest';
import {
  MIN_SAMPLE,
  type ChangeInput,
  changeText,
  countText,
  median,
  percentile,
  scoreBinIndex,
  scoreBinLabel,
  scoreBins,
  trendDraw,
  trendHeights,
} from './stats-math.ts';
import { labelsOverlap } from './range-strip.ts';

describe('median', () => {
  it('takes the middle value of an odd count', () => {
    expect(median([9, 1, 5])).toBe(5);
  });

  it('takes the mean of the two middle values of an even count', () => {
    expect(median([4, 1, 3, 10])).toBe(3.5);
  });

  it('returns the only value', () => {
    expect(median([7])).toBe(7);
  });

  it('returns null for no value', () => {
    expect(median([])).toBeNull();
  });
});

describe('percentile', () => {
  const ten = [10, 1, 9, 2, 8, 3, 7, 4, 6, 5];

  it('takes the nearest rank at 90 on one value', () => {
    expect(percentile([42], 90)).toBe(42);
  });

  it('takes rank 9 of 10 values', () => {
    expect(percentile(ten, 90)).toBe(9);
  });

  it('takes rank 10 of 11 values', () => {
    expect(percentile([...ten, 11], 90)).toBe(10);
  });

  it('returns null for no value', () => {
    expect(percentile([], 90)).toBeNull();
  });
});

describe('changeText', () => {
  const base: ChangeInput = {
    kind: 'share',
    value: 0.62,
    n: 14,
    previous: 0.5,
    previousN: 12,
    comparison: 'previous 30 days',
    better: 'higher',
  };

  it('gives a share change in whole points', () => {
    expect(changeText(base)).toEqual({
      direction: 'up',
      amount: '12 pts',
      comparison: 'previous 30 days',
      tone: 'better',
      detail: '12 pts vs previous 30 days',
      text: '▲ 12 pts vs previous 30 days',
    });
  });

  it('says one point in the singular', () => {
    expect(changeText({ ...base, value: 0.49 })?.text).toBe(
      '▼ 1 pt vs previous 30 days',
    );
  });

  it('gives an amount change in whole percent of the previous value', () => {
    expect(
      changeText({ ...base, kind: 'amount', value: 82, previous: 100 }),
    ).toMatchObject({ direction: 'down', amount: '18%', tone: 'worse' });
  });

  it('treats a fall as better when lower is better', () => {
    expect(
      changeText({
        ...base,
        kind: 'amount',
        value: 82,
        previous: 100,
        better: 'lower',
      })?.tone,
    ).toBe('better');
  });

  it('rounds the unrounded difference', () => {
    expect(changeText({ ...base, value: 0.5149, previous: 0.5 })?.text).toBe(
      '▲ 1 pt vs previous 30 days',
    );
    expect(changeText({ ...base, value: 0.5049, previous: 0.5 })?.text).toBe(
      'No change vs previous 30 days',
    );
  });

  it('reads a negative zero as no change', () => {
    const change = changeText({ ...base, value: 0.498, previous: 0.5 });
    expect(change).toMatchObject({
      direction: null,
      tone: 'none',
      text: 'No change vs previous 30 days',
    });
  });

  it('leaves out the comparison when none is given', () => {
    expect(changeText({ ...base, comparison: '' })?.text).toBe('▲ 12 pts');
    expect(changeText({ ...base, comparison: '', value: 0.5 })?.text).toBe(
      'No change',
    );
  });

  it('has no change for an amount whose previous value is 0', () => {
    expect(
      changeText({ ...base, kind: 'amount', value: 3, previous: 0 }),
    ).toBeNull();
  });

  it('compares a share with a previous value of 0', () => {
    expect(changeText({ ...base, value: 0.1, previous: 0 })?.text).toBe(
      '▲ 10 pts vs previous 30 days',
    );
  });

  it('has no change without a usable previous value or sample', () => {
    expect(changeText({ ...base, previous: undefined })).toBeNull();
    expect(changeText({ ...base, previous: null })).toBeNull();
    expect(changeText({ ...base, previousN: MIN_SAMPLE - 1 })).toBeNull();
    expect(changeText({ ...base, n: MIN_SAMPLE - 1 })).toBeNull();
    expect(changeText({ ...base, value: null })).toBeNull();
  });
});

describe('score bins', () => {
  it('bins scores by 5 points, 100 in the last bin, clamped', () => {
    expect([0, 4, 5, 95, 100, -3, 140].map(scoreBinIndex)).toEqual([
      0, 0, 1, 19, 19, 0, 19,
    ]);
  });

  it('labels the bins', () => {
    expect(scoreBinLabel(0)).toBe('0–4');
    expect(scoreBinLabel(17)).toBe('85–89');
    expect(scoreBinLabel(19)).toBe('95–100');
  });

  it("splits a bin by each report's own threshold", () => {
    const { bins, latestThreshold, varied } = scoreBins([
      { score: 70, threshold: 72, time: '2026-11-01T00:00:00Z' },
      { score: 73, threshold: 72, time: '2026-11-02T00:00:00Z' },
      { score: 74, threshold: 75, time: '2026-11-03T00:00:00Z' },
      { score: 72, threshold: 72, time: '2026-11-04T00:00:00Z' },
    ]);
    expect(bins[14]).toEqual({ label: '70–74', total: 4, below: 2 });
    expect(bins.filter((bin) => bin.total > 0)).toHaveLength(1);
    expect(latestThreshold).toBe(72);
    expect(varied).toBe(true);
  });

  it('takes the threshold of the latest report, the last given on a tie', () => {
    const time = '2026-11-01T00:00:00Z';
    const result = scoreBins([
      { score: 90, threshold: 80, time: '2026-11-05T00:00:00Z' },
      { score: 90, threshold: 75, time },
      { score: 90, threshold: 70, time: '2026-11-05T00:00:00Z' },
    ]);
    expect(result.latestThreshold).toBe(70);
    expect(result.varied).toBe(true);
  });

  it('is not varied when every threshold is the same', () => {
    const result = scoreBins([
      { score: 90, threshold: 80, time: '2026-11-05T00:00:00Z' },
      { score: 60, threshold: 80, time: '2026-11-06T00:00:00Z' },
    ]);
    expect(result).toMatchObject({ latestThreshold: 80, varied: false });
  });

  it('has no threshold without reports', () => {
    expect(scoreBins([])).toMatchObject({
      latestThreshold: null,
      varied: false,
    });
  });
});

describe('labelsOverlap', () => {
  it('tells close labels from distant ones', () => {
    const median = { centre: 100, width: 80 };
    expect(labelsOverlap(median, { centre: 150, width: 60 }, 400)).toBe(true);
    expect(labelsOverlap(median, { centre: 250, width: 60 }, 400)).toBe(false);
  });
});

describe('countText', () => {
  const noun = { one: 'merged issue', other: 'merged issues' };

  it('uses the singular for one item only', () => {
    expect(countText(1, noun)).toBe('1 merged issue');
    expect(countText(0, noun)).toBe('0 merged issues');
    expect(countText(14, noun)).toBe('14 merged issues');
  });
});

describe('trendHeights', () => {
  it('scales counts to the largest value among every bucket with a value, small samples included', () => {
    expect(
      trendHeights(
        [
          { label: 'W1', value: 50, n: 2, text: '50' },
          { label: 'W2', value: 10, text: '10' },
          { label: 'W3', value: 5, n: 6, text: '5' },
          { label: 'W4', value: null, text: '—' },
          { label: 'W5', value: 80, n: 0, text: '80' },
        ],
        'count',
        40,
      ),
    ).toEqual([40, 8, 4, 2, 2]);
  });

  it('draws a small sample at its value, and n = 0 or a null value as a stub', () => {
    const buckets = [
      { label: 'n0', value: 0.5, n: 0, text: '—' },
      { label: 'n1', value: 0.5, n: 1, text: '50%' },
      { label: 'n4', value: 0.75, n: 4, text: '75%' },
      { label: 'n5', value: 1, n: 5, text: '100%' },
      { label: 'null', value: null, n: 3, text: '—' },
    ];
    expect(trendHeights(buckets, 'share', 40)).toEqual([2, 20, 30, 40, 2]);
    expect(buckets.map(trendDraw)).toEqual([
      'empty',
      'small',
      'small',
      'full',
      'empty',
    ]);
  });

  it('scales shares out of 100%', () => {
    expect(
      trendHeights(
        [
          { label: 'W1', value: 0.5, n: 9, text: '50%' },
          { label: 'W2', value: 0, n: 9, text: '0%' },
        ],
        'share',
        40,
      ),
    ).toEqual([20, 2]);
  });
});
