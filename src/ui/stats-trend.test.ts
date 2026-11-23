import { describe, expect, it } from 'vitest';
import {
  autonomyBuckets,
  hourKey,
  mergedBuckets,
  mergedTitle,
  qualityBuckets,
  trendLabels,
  trendTitle,
} from './stats-view.ts';

const NOW = new Date(2026, 10, 23, 14, 20);

describe('stats trends', () => {
  it('labels the weeks by their Monday, the current one last', () => {
    expect(
      autonomyBuckets(
        {
          unit: 'week',
          buckets: [
            { start: '2026-10-26', merged: 4, mergedWithoutPerson: 3 },
            { start: '2026-11-02', merged: 0, mergedWithoutPerson: 0 },
            { start: '2026-11-16', merged: 2, mergedWithoutPerson: 1 },
          ],
        },
        NOW,
      ),
    ).toEqual([
      { label: 'Oct 26', value: 0.75, n: 4, text: '75% · 3 of 4' },
      { label: 'Nov 2', value: null, n: 0, text: 'No issue merged' },
      { label: 'this week', value: 0.5, n: 2, text: '50% · 1 of 2' },
    ]);
  });

  it('labels hours, days, months and years, the current one by its name', () => {
    const starts = (keys: string[]) => keys.map((start) => ({ start }));
    expect(
      trendLabels(
        {
          unit: 'hour',
          buckets: starts([
            '2026-11-23T13:00',
            '2026-11-23T14:00',
            '2026-11-23T15:00',
          ]),
        },
        NOW,
      ),
    ).toEqual(['13:00', 'this hour', '15:00']);
    expect(
      trendLabels(
        { unit: 'day', buckets: starts(['2026-11-22', '2026-11-23']) },
        NOW,
      ),
    ).toEqual(['Nov 22', 'today']);
    expect(
      trendLabels(
        { unit: 'month', buckets: starts(['2025-12-01', '2026-11-01']) },
        NOW,
      ),
    ).toEqual(['Dec 2025', 'this month']);
    expect(
      trendLabels(
        { unit: 'year', buckets: starts(['2025-01-01', '2026-01-01']) },
        NOW,
      ),
    ).toEqual(['2025', 'this year']);
    expect(hourKey(NOW)).toBe('2026-11-23T14:00');
  });

  it('labels the repeated hour of a clock change as the current one only once, the later', () => {
    const repeated = [
      { start: '2026-10-25T01:00' },
      { start: '2026-10-25T02:00' },
      { start: '2026-10-25T02:00' },
    ];
    expect(
      trendLabels(
        { unit: 'hour', buckets: repeated },
        new Date(2026, 9, 25, 2, 30),
      ),
    ).toEqual(['01:00', '02:00', 'this hour']);
  });

  it('names the unit in the trend titles', () => {
    expect(trendTitle('Merged without a person', 'hour')).toBe(
      'Merged without a person, by hour',
    );
    expect(trendTitle('Right the first time', 'month')).toBe(
      'Right the first time, by month',
    );
    expect(mergedTitle('day')).toBe('Merged per day');
    expect(mergedTitle('year')).toBe('Merged per year');
  });

  it('labels the weeks by their Monday with the share passed the first time', () => {
    expect(
      qualityBuckets(
        {
          unit: 'week',
          buckets: [
            { start: '2026-11-02', mergedWithReport: 5, firstPassed: 3 },
            { start: '2026-11-09', mergedWithReport: 0, firstPassed: 0 },
            { start: '2026-11-16', mergedWithReport: 2, firstPassed: 2 },
          ],
        },
        NOW,
      ),
    ).toEqual([
      { label: 'Nov 2', value: 0.6, n: 5, text: '60% · 3 of 5' },
      {
        label: 'Nov 9',
        value: null,
        n: 0,
        text: 'No merged issue with a report',
      },
      { label: 'this week', value: 1, n: 2, text: '100% · 2 of 2' },
    ]);
  });

  it('counts the merges of each week', () => {
    expect(
      mergedBuckets(
        {
          unit: 'week',
          buckets: [
            { start: '2026-11-09', merged: 1 },
            { start: '2026-11-16', merged: 0 },
            { start: '2026-11-23', merged: 4 },
          ],
        },
        NOW,
      ),
    ).toEqual([
      { label: 'Nov 9', value: 1, text: '1 issue' },
      { label: 'Nov 16', value: 0, text: '0 issues' },
      { label: 'this week', value: 4, text: '4 issues' },
    ]);
  });
});
