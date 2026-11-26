import { describe, expect, it } from 'vitest';
import { bugBuckets, bugFigures, stripItems } from './stats-view.ts';

const HOUR = 3_600_000;
const openings = { created: 0, reopened: 0 };

describe('bugs view', () => {
  it('computes the time to fix, the share of bugs and the reopened bugs', () => {
    expect(
      bugFigures({
        merged: 8,
        bugs: 4,
        reopened: 1,
        fixMs: [HOUR, 2 * HOUR, 4 * HOUR, 10 * HOUR],
        openings,
      }),
    ).toEqual({ fix: 3 * HOUR, share: 0.5, reopened: 0.25 });
  });

  it('has no figure without a merged issue or bug', () => {
    expect(
      bugFigures({ merged: 0, bugs: 0, reopened: 0, fixMs: [], openings }),
    ).toEqual({
      fix: null,
      share: null,
      reopened: null,
    });
    expect(
      bugFigures({ merged: 3, bugs: 0, reopened: 0, fixMs: [], openings }),
    ).toEqual({
      fix: null,
      share: 0,
      reopened: null,
    });
  });

  it('gives the share of bugs per bucket, out of every merged issue', () => {
    const buckets = bugBuckets(
      {
        unit: 'week',
        buckets: [
          { start: '2026-11-09', merged: 0, bugs: 0, opened: 0 },
          { start: '2026-11-16', merged: 4, bugs: 1, opened: 2 },
        ],
      },
      new Date(2026, 10, 18),
    );
    expect(buckets).toEqual([
      { label: 'Nov 9', value: null, n: 0, text: 'No issue merged' },
      { label: 'this week', value: 0.25, n: 4, text: '25% · 1 of 4' },
    ]);
  });

  it('links each bug of the strip to its issue page with the period', () => {
    expect(
      stripItems(
        [{ project: '/work/app', number: 9, title: 'Crash', fixMs: HOUR }],
        (issue) => issue.fixMs,
        '7d',
      ),
    ).toEqual([
      {
        label: '#9 Crash',
        value: HOUR,
        href: '/features/9?project=%2Fwork%2Fapp&period=7d',
      },
    ]);
  });
});
