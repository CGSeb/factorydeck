import { describe, expect, it } from 'vitest';
import { columnLayout, columnOf, dotColumns, pillText } from './dot-columns.ts';

function overlaps(pills: readonly { left: number; width: number }[]): boolean {
  const sorted = [...pills].sort((a, b) => a.left - b.left);
  return sorted.some((pill, index) => {
    const next = sorted[index + 1];
    return next !== undefined && pill.left + pill.width > next.left;
  });
}

describe('dot columns', () => {
  it('puts equal values in one column, on its centre', () => {
    expect(dotColumns([40, 40, 40], 300)).toEqual([
      { index: 1, left: 28, width: 28, centre: 42, items: [0, 1, 2] },
    ]);
  });

  it('splits values 1 px apart across a column edge', () => {
    expect(
      dotColumns([55.5, 56.5], 300).map((c) => [c.index, c.items]),
    ).toEqual([
      [1, [0]],
      [2, [1]],
    ]);
  });

  it('puts an item at each end in the first and the last column', () => {
    expect(columnOf(0, 300)).toBe(0);
    expect(columnOf(300, 300)).toBe(10);
    expect(columnOf(280, 280)).toBe(9);
    const [first, last] = dotColumns([0, 300], 300);
    expect(first?.centre).toBe(14);
    expect(last).toEqual({
      index: 10,
      left: 280,
      width: 20,
      centre: 290,
      items: [1],
    });
  });

  it('keeps a column of 5 whole', () => {
    const { dots, pills } = columnLayout([5, 5, 5, 5, 5], 300);
    expect(dots.map((dot) => [dot.level, dot.folded])).toEqual([
      [0, false],
      [1, false],
      [2, false],
      [3, false],
      [4, false],
    ]);
    expect(pills).toEqual([]);
  });

  it('folds a column of 6 into 4 dots and a +2 pill', () => {
    const { dots, pills } = columnLayout([5, 5, 5, 5, 5, 6], 300);
    expect(dots.filter((dot) => !dot.folded).map((dot) => dot.level)).toEqual([
      0, 1, 2, 3,
    ]);
    expect(pills).toEqual([
      {
        stack: 0,
        x: 14,
        left: 0,
        width: 28,
        level: 4,
        hidden: 2,
        text: '+2',
        items: [4, 5],
      },
    ]);
  });

  it('reads +99 for 103 items and 99+ for 104', () => {
    expect(columnLayout(Array(103).fill(10), 300).pills[0]?.text).toBe('+99');
    expect(columnLayout(Array(104).fill(10), 300).pills[0]?.text).toBe('99+');
    expect(pillText(100)).toBe('99+');
  });

  it('keeps a strip narrower than one column in one column', () => {
    const { dots, pills } = columnLayout([0, 5, 10, 15, 20, 20], 20);
    expect(new Set(dots.map((dot) => dot.x))).toEqual(new Set([10]));
    expect(pills.map((pill) => [pill.left, pill.width, pill.text])).toEqual([
      [0, 20, '+2'],
    ]);
  });

  it('widens the pill of a narrow last column over a free neighbour', () => {
    const six = Array<number>(6).fill(300);
    expect(columnLayout([250, ...six], 300).pills).toMatchObject([
      { stack: 10, x: 290, left: 272, width: 28, text: '+2' },
    ]);
  });

  it('keeps the pill of a narrow last column inside it next to a full neighbour', () => {
    const five = Array<number>(5).fill(270);
    const six = Array<number>(6).fill(300);
    const { pills } = columnLayout([...five, ...six], 300);
    expect(pills).toMatchObject([
      { stack: 10, left: 280, width: 20, text: '+2' },
    ]);
  });

  it('never overlaps two pills', () => {
    for (const width of [20, 100, 290, 300, 360, 1000, 1024]) {
      for (const seed of [1, 7, 13]) {
        const xs = Array.from({ length: 255 }, (_, index) =>
          Math.min(width, (index * index * seed) % (width + 30)),
        ).sort((a, b) => a - b);
        const { pills } = columnLayout(xs, width);
        expect(overlaps(pills)).toBe(false);
        for (const pill of pills) {
          expect(pill.left).toBeGreaterThanOrEqual(0);
          expect(pill.left + pill.width).toBeLessThanOrEqual(width);
        }
      }
    }
  });
});
