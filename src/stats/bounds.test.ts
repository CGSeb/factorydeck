import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import type { Period } from '../overview/types.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { type IssueFacts, bucketCounts } from './autonomy.ts';
import { earliestMerge, statsBounds } from './bounds.ts';

const NOW = new Date('2026-11-25T15:30:00Z');
const DAY = 24 * 3_600_000;
const WEEK = 7 * DAY;

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
});

afterAll(async () => {
  await close();
});

function bounds(
  period: Period,
  options: { timeZone?: string; now?: Date; earliest?: number | null } = {},
) {
  return statsBounds(db, {
    period,
    timeZone: options.timeZone ?? 'UTC',
    now: options.now ?? NOW,
    earliestMerge: options.earliest ?? null,
  });
}

function keys(cut: Awaited<ReturnType<typeof bounds>>): string[] {
  return cut.buckets.map((bucket) => bucket.key);
}

function iso(at: number | undefined): string {
  return new Date(at ?? 0).toISOString();
}

function merged(at: string, stage: IssueFacts['stage'] = 'merged'): IssueFacts {
  return {
    open: false,
    stage,
    mergedAt: Date.parse(at),
    episodes: [],
    reasons: [],
  };
}

describe('trend buckets', () => {
  it('cuts today into the 24 hours of the local day', async () => {
    const cut = await bounds('today', { timeZone: 'Europe/Paris' });
    expect(cut.unit).toBe('hour');
    expect(keys(cut)).toHaveLength(24);
    expect(keys(cut)[0]).toBe('2026-11-25T00:00');
    expect(keys(cut)[14]).toBe('2026-11-25T14:00');
    expect(keys(cut).at(-1)).toBe('2026-11-25T23:00');
    expect(iso(cut.buckets[0]?.start)).toBe('2026-11-24T23:00:00.000Z');
  });

  it('has 23 hours on the day clocks go forward', async () => {
    const cut = await bounds('today', {
      timeZone: 'Europe/Paris',
      now: new Date('2026-03-29T12:00:00Z'),
    });
    expect(keys(cut)).toHaveLength(23);
    expect(keys(cut).slice(1, 3)).toEqual([
      '2026-03-29T01:00',
      '2026-03-29T03:00',
    ]);
    expect(keys(cut).at(-1)).toBe('2026-03-29T23:00');
  });

  it('has 25 hours on the day clocks go back, the repeated hour twice', async () => {
    const cut = await bounds('today', {
      timeZone: 'Europe/Paris',
      now: new Date('2026-10-25T12:00:00Z'),
    });
    expect(keys(cut)).toHaveLength(25);
    expect(keys(cut).slice(2, 4)).toEqual([
      '2026-10-25T02:00',
      '2026-10-25T02:00',
    ]);
    expect(iso(cut.buckets[2]?.start)).toBe('2026-10-25T00:00:00.000Z');
    expect(iso(cut.buckets[3]?.start)).toBe('2026-10-25T01:00:00.000Z');
  });

  it('cuts the last 7 and 30 days by local day across a month change, today last', async () => {
    const now = new Date('2026-12-02T10:00:00Z');
    const week = await bounds('7d', { now, timeZone: 'America/New_York' });
    expect(week.unit).toBe('day');
    expect(keys(week)).toEqual([
      '2026-11-26',
      '2026-11-27',
      '2026-11-28',
      '2026-11-29',
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
    ]);
    expect(iso(week.buckets[0]?.start)).toBe('2026-11-26T05:00:00.000Z');
    const month = await bounds('30d', { now });
    expect(month.unit).toBe('day');
    expect(keys(month)).toHaveLength(30);
    expect(keys(month)[0]).toBe('2026-11-03');
    expect(keys(month).at(-1)).toBe('2026-12-02');
  });

  it('cuts all time by week from the week of the first merge', async () => {
    const cut = await bounds('all', { earliest: NOW.getTime() - 3 * WEEK });
    expect(cut.unit).toBe('week');
    expect(keys(cut)).toEqual([
      '2026-11-02',
      '2026-11-09',
      '2026-11-16',
      '2026-11-23',
    ]);
  });

  it('keeps weeks for a first merge 26 weeks ago', async () => {
    const cut = await bounds('all', { earliest: NOW.getTime() - 26 * WEEK });
    expect(cut.unit).toBe('week');
    expect(keys(cut)).toHaveLength(27);
    expect(keys(cut).at(-1)).toBe('2026-11-23');
  });

  it('cuts by month for a first merge 27 weeks ago', async () => {
    const cut = await bounds('all', { earliest: NOW.getTime() - 27 * WEEK });
    expect(cut.unit).toBe('month');
    expect(keys(cut)).toEqual([
      '2026-05-01',
      '2026-06-01',
      '2026-07-01',
      '2026-08-01',
      '2026-09-01',
      '2026-10-01',
      '2026-11-01',
    ]);
  });

  it('keeps months up to 36 buckets, then cuts by year', async () => {
    const months = await bounds('all', {
      earliest: Date.parse('2023-12-15T00:00:00Z'),
    });
    expect(months.unit).toBe('month');
    expect(keys(months)).toHaveLength(36);
    const years = await bounds('all', {
      earliest: Date.parse('2023-11-30T00:00:00Z'),
    });
    expect(years.unit).toBe('year');
    expect(keys(years)).toEqual([
      '2023-01-01',
      '2024-01-01',
      '2025-01-01',
      '2026-01-01',
    ]);
  });

  it('shows the 12 weeks ending with the current one when nothing was merged', async () => {
    const cut = await bounds('all');
    expect(cut.unit).toBe('week');
    expect(keys(cut)).toHaveLength(12);
    expect(keys(cut)[0]).toBe('2026-09-07');
    expect(keys(cut).at(-1)).toBe('2026-11-23');
  });

  it('takes the earliest merge of the issues, leaving out the unmerged', () => {
    expect(
      earliestMerge([
        { mergedAt: null },
        { mergedAt: 30 },
        { mergedAt: 10 },
        { mergedAt: 20 },
      ]),
    ).toBe(10);
    expect(earliestMerge([{ mergedAt: null }])).toBeNull();
  });

  it('counts a merge on an hour edge in the hour it opens', async () => {
    const cut = await bounds('today');
    const counts = bucketCounts(
      [
        merged('2026-11-25T09:59:59Z'),
        merged('2026-11-25T10:00:00Z'),
        merged('2026-11-25T10:59:59Z', 'merged-by-person'),
        merged('2026-11-24T23:59:59Z'),
      ],
      cut.buckets,
    );
    expect(counts.slice(9, 12)).toEqual([
      { start: '2026-11-25T09:00', merged: 1, mergedWithoutPerson: 1 },
      { start: '2026-11-25T10:00', merged: 2, mergedWithoutPerson: 1 },
      { start: '2026-11-25T11:00', merged: 0, mergedWithoutPerson: 0 },
    ]);
    expect(counts.reduce((sum, bucket) => sum + bucket.merged, 0)).toBe(3);
  });
});
