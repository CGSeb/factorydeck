import { describe, expect, it } from 'vitest';
import { autonomyLoader } from './stats-api.ts';
import {
  autonomyFigures,
  autonomySummary,
  comparisonText,
  reasonRows,
  waitingNote,
  weekBuckets,
} from './stats-view.ts';

const HOUR = 3_600_000;

describe('stats view', () => {
  it('names the previous period of each period', () => {
    expect(comparisonText('today')).toBe('yesterday');
    expect(comparisonText('7d')).toBe('previous 7 days');
    expect(comparisonText('30d')).toBe('previous 30 days');
    expect(comparisonText('all')).toBeUndefined();
  });

  it('sums up the merged issues', () => {
    const counts = { mergedAfterQuestion: 0, answeredWaitsMs: [] };
    expect(
      autonomySummary({ ...counts, merged: 1, mergedWithoutPerson: 1 }),
    ).toBe('1 issue merged · 1 without a person');
    expect(
      autonomySummary({ ...counts, merged: 4, mergedWithoutPerson: 3 }),
    ).toBe('4 issues merged · 3 without a person');
    expect(
      autonomySummary({ ...counts, merged: 0, mergedWithoutPerson: 0 }),
    ).toBe('No issue merged');
  });

  it('computes the shares and the median wait', () => {
    expect(
      autonomyFigures({
        merged: 4,
        mergedWithoutPerson: 3,
        mergedAfterQuestion: 1,
        answeredWaitsMs: [HOUR, 3 * HOUR],
      }),
    ).toEqual({ withoutPerson: 0.75, specQuestions: 0.25, waiting: 2 * HOUR });
    expect(
      autonomyFigures({
        merged: 0,
        mergedWithoutPerson: 0,
        mergedAfterQuestion: 0,
        answeredWaitsMs: [],
      }),
    ).toEqual({ withoutPerson: null, specQuestions: null, waiting: null });
    expect(
      autonomyFigures({
        merged: 0,
        mergedWithoutPerson: 0,
        mergedAfterQuestion: 0,
        answeredWaitsMs: [1, 2, 3, 4, 5].map((hours) => hours * HOUR),
      }).waiting,
    ).toBeNull();
  });

  it('notes the questions still waiting, none at 0', () => {
    expect(waitingNote(2)).toBe('2 still waiting');
    expect(waitingNote(0)).toBeUndefined();
  });

  it('labels the weeks by their Monday, the current one last', () => {
    expect(
      weekBuckets([
        { start: '2026-10-26', merged: 4, mergedWithoutPerson: 3 },
        { start: '2026-11-02', merged: 0, mergedWithoutPerson: 0 },
        { start: '2026-11-16', merged: 2, mergedWithoutPerson: 1 },
      ]),
    ).toEqual([
      { label: 'Oct 26', value: 0.75, n: 4, text: '75% · 3 of 4' },
      { label: 'Nov 2', value: null, n: 0, text: 'No issue merged' },
      { label: 'this week', value: 0.5, n: 2, text: '50% · 1 of 2' },
    ]);
  });

  it('lists the four reasons in their order', () => {
    expect(
      reasonRows({
        specQuestion: 1,
        belowThreshold: 2,
        gatesFailed: 3,
        autoMergeOff: 4,
        total: 7,
      }),
    ).toEqual([
      { label: 'Spec question', count: 1 },
      { label: 'Score below threshold', count: 2 },
      { label: 'Gates failed', count: 3 },
      { label: 'Auto-merge off', count: 4 },
    ]);
  });
});

describe('autonomy API', () => {
  it('asks for the autonomy figures of the period and project', async () => {
    const urls: string[] = [];
    const response = await autonomyLoader(
      (input) => {
        urls.push(typeof input === 'string' ? input : '');
        return Promise.resolve(Response.json({ status: 'unreachable' }));
      },
      () => 'UTC',
    )({ period: '30d', project: '/work/app' });
    expect(response).toEqual({ status: 'unreachable' });
    expect(urls).toEqual([
      '/api/stats/autonomy?period=30d&tz=UTC&project=%2Fwork%2Fapp',
    ]);
  });

  it('gives nothing for an unexpected answer', async () => {
    await expect(
      autonomyLoader(
        () => Promise.resolve(Response.json({ error: 'nope' })),
        () => 'UTC',
      )({ period: '7d', project: undefined }),
    ).resolves.toBeUndefined();
  });
});
