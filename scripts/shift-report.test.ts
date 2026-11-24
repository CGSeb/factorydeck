import { describe, expect, it } from 'vitest';
import { describeMoves, movesOf } from './shift-report.ts';

const ELEMENTS = ['title', 'pills', 'panel'];
const BEFORE = { title: 20, pills: 24, panel: 100 };

function frames(...panels: (number | null)[]) {
  return panels.map((panel, index) => ({
    at: index * 16,
    tops: { title: 20, pills: 24, panel },
  }));
}

describe('movesOf', () => {
  it('finds nothing when every element stays within half a pixel', () => {
    expect(movesOf(BEFORE, frames(100, 100.4), ELEMENTS, 20)).toEqual([]);
  });

  it('reports a move before the data arrived as a shift', () => {
    expect(movesOf(BEFORE, frames(100, 140, 100), ELEMENTS, 40)).toEqual([
      { element: 'panel', from: 100, to: 140, frame: 1, beforeData: true },
    ]);
  });

  it('reports a move once the data arrived as content that changed', () => {
    expect(movesOf(BEFORE, frames(100, 100, 140), ELEMENTS, 20)).toEqual([
      { element: 'panel', from: 100, to: 140, frame: 2, beforeData: false },
    ]);
  });

  it('counts every move as a shift when the action loaded nothing', () => {
    expect(movesOf(BEFORE, frames(100, 100, 140), ELEMENTS, null)).toEqual([
      { element: 'panel', from: 100, to: 140, frame: 2, beforeData: true },
    ]);
  });

  it('ignores frames where an element is not on the page', () => {
    expect(movesOf(BEFORE, frames(null, 100), ELEMENTS, 0)).toEqual([]);
    expect(
      movesOf({ ...BEFORE, pills: null }, frames(100), ELEMENTS, 0),
    ).toEqual([]);
  });

  it('watches only the elements asked for', () => {
    expect(movesOf(BEFORE, frames(300), ['title'], null)).toEqual([]);
  });
});

describe('describeMoves', () => {
  const late = {
    element: 'panel',
    from: 100,
    to: 140.26,
    frame: 2,
    beforeData: false,
  };

  it('says when nothing moved', () => {
    expect(describeMoves('Period: All time', 120, [])).toBe(
      'ok    Period: All time: nothing moved over 120 frames',
    );
  });

  it('accepts a move once the data arrived', () => {
    expect(describeMoves('Period: Today', 90, [late])).toBe(
      'ok    Period: Today: moved only once the data arrived (panel 100 px → 140.3 px at frame 3)',
    );
  });

  it('lists only the shifts when there are some', () => {
    expect(
      describeMoves('Period: Today', 90, [
        late,
        { element: 'title', from: 20, to: 30, frame: 1, beforeData: true },
      ]),
    ).toBe('SHIFT Period: Today: title 20 px → 30 px at frame 2');
  });
});
