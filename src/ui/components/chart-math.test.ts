import { describe, expect, it } from 'vitest';
import {
  COLUMN_STUB_PX,
  barPercent,
  columnHeights,
  edgeLabels,
  splitParts,
  wholePercent,
} from './chart-math.ts';

describe('wholePercent', () => {
  it('rounds the share to a whole percent', () => {
    expect(wholePercent(45, 100)).toBe(45);
    expect(wholePercent(1, 3)).toBe(33);
    expect(wholePercent(2, 3)).toBe(67);
    expect(wholePercent(1, 200)).toBe(1);
    expect(wholePercent(1, 1000)).toBe(0);
  });

  it('is 0 without a total or a value', () => {
    expect(wholePercent(0, 0)).toBe(0);
    expect(wholePercent(5, 0)).toBe(0);
    expect(wholePercent(0, 10)).toBe(0);
  });
});

describe('splitParts', () => {
  it('weights each segment in proportion to its value', () => {
    const parts = splitParts([
      { label: 'a', value: 450 },
      { label: 'b', value: 350 },
      { label: 'c', value: 200 },
    ]);
    expect(parts.map((part) => part.share)).toEqual([45, 35, 20]);
    const [a, b, c] = parts.map((part) => part.weight);
    expect((a ?? 0) / (b ?? 1)).toBeCloseTo(450 / 350);
    expect((b ?? 0) / (c ?? 1)).toBeCloseTo(350 / 200);
  });

  it('keeps every weight above 1 so flex fills the whole track', () => {
    const parts = splitParts([
      { label: 'big', value: 999_999 },
      { label: 'tiny', value: 1 },
    ]);
    expect(parts.map((part) => part.label)).toEqual(['big', 'tiny']);
    expect(parts[0]?.weight).toBeGreaterThan(1);
    expect(parts.reduce((sum, part) => sum + part.weight, 0)).toBeCloseTo(1000);
  });

  it('leaves out segments at 0 and below', () => {
    const parts = splitParts([
      { label: 'a', value: 3 },
      { label: 'zero', value: 0 },
      { label: 'negative', value: -2 },
      { label: 'b', value: 1 },
    ]);
    expect(parts.map((part) => [part.label, part.share])).toEqual([
      ['a', 75],
      ['b', 25],
    ]);
  });

  it('has no part when every segment is at 0', () => {
    expect(splitParts([{ value: 0 }, { value: 0 }])).toEqual([]);
    expect(splitParts([])).toEqual([]);
  });

  it('gives a single segment the whole bar', () => {
    expect(splitParts([{ value: 7 }])).toEqual([
      { value: 7, share: 100, weight: 1000 },
    ]);
  });
});

describe('columnHeights', () => {
  it('scales each column to the largest value', () => {
    expect(columnHeights([10, 5, 2.5], 80)).toEqual([80, 40, 20]);
  });

  it('draws a 2 px stub for a bucket at 0', () => {
    expect(columnHeights([0, 4], 40)).toEqual([COLUMN_STUB_PX, 40]);
  });

  it('never draws a value above 0 lower than the stub', () => {
    expect(columnHeights([1, 1000], 40)).toEqual([COLUMN_STUB_PX, 40]);
  });

  it('draws only stubs when every bucket is at 0', () => {
    expect(columnHeights([0, 0, 0], 56)).toEqual([2, 2, 2]);
    expect(columnHeights([], 56)).toEqual([]);
  });
});

describe('barPercent', () => {
  it('divides the value by the largest of the column', () => {
    expect(barPercent(50, 200)).toBe(25);
    expect(barPercent(200, 200)).toBe(100);
  });

  it('draws no bar for 0 or an empty column', () => {
    expect(barPercent(0, 200)).toBe(0);
    expect(barPercent(0, 0)).toBe(0);
  });

  it('never goes past the track', () => {
    expect(barPercent(300, 200)).toBe(100);
  });
});

describe('edgeLabels', () => {
  it('keeps every label up to 7 buckets', () => {
    expect(edgeLabels([1, 2, 3, 4, 5, 6, 7])).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(edgeLabels([1])).toEqual([1]);
  });

  it('keeps the first and last labels above 7 buckets', () => {
    expect(edgeLabels([1, 2, 3, 4, 5, 6, 7, 8])).toEqual([1, 8]);
  });

  it('has no label without buckets', () => {
    expect(edgeLabels([])).toEqual([]);
  });
});
