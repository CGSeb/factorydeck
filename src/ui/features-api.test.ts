import { describe, expect, it } from 'vitest';
import type { FeatureRow } from '../features/types.ts';
import {
  DEFAULT_SORT,
  featureLoader,
  featurePath,
  featuresLoader,
  nextSort,
  sortFeatures,
  sortOf,
} from './features-api.ts';
import { splitTokens } from './token-fixtures.ts';

function recorder(urls: string[], body: unknown): typeof fetch {
  return (input) => {
    urls.push(typeof input === 'string' ? input : '');
    return Promise.resolve(Response.json(body));
  };
}

function row(
  number: number,
  costUsd: number | null,
  score: number | null,
  project = '/work/app',
): FeatureRow {
  return {
    project,
    projectName: 'app',
    number,
    issue: { status: 'not-collected' },
    outcome:
      score === null
        ? null
        : {
            stage: 'merged',
            report: { score, threshold: 80, rounds: 1 },
            reworked: false,
          },
    sessions: 1,
    apiCalls: 1,
    tokens: 100,
    tokenCounts: splitTokens(100),
    costUsd,
    orchestrationCostUsd: null,
    lastAt: '2026-01-05T09:00:00.000Z',
    roles: [
      { role: 'builder', tokens: 100, tokenCounts: splitTokens(100), costUsd },
    ],
  };
}

describe('features API', () => {
  it('asks for the issues of the period and project', async () => {
    const urls: string[] = [];
    const response = await featuresLoader(
      recorder(urls, { status: 'unreachable' }),
      () => 'UTC',
    )({ period: 'all', project: '/work/app' });
    expect(response).toEqual({ status: 'unreachable' });
    expect(urls).toEqual([
      '/api/features?period=all&tz=UTC&project=%2Fwork%2Fapp',
    ]);
  });

  it('asks for one issue of a project', async () => {
    const urls: string[] = [];
    const response = await featureLoader(
      recorder(urls, { status: 'not-found', refreshSeconds: 10 }),
      () => 'UTC',
    )(
      { project: '/work/app', number: 7 },
      { period: '7d', project: undefined },
    );
    expect(response).toEqual({ status: 'not-found', refreshSeconds: 10 });
    expect(urls).toEqual([
      '/api/features/7?period=7d&tz=UTC&project=%2Fwork%2Fapp',
    ]);
  });

  it('gives nothing for an unexpected answer', async () => {
    await expect(
      featuresLoader(
        recorder([], { error: 'nope' }),
        () => 'UTC',
      )({
        period: '7d',
        project: undefined,
      }),
    ).resolves.toBeUndefined();
  });

  it('links an issue page with its URL-encoded project and period', () => {
    expect(
      featurePath({ project: '/work/my app', number: 7 }, { period: 'all' }),
    ).toBe('/features/7?project=%2Fwork%2Fmy+app&period=all');
  });
});

describe('sorting', () => {
  it('reads the sort of the address, cost descending by default', () => {
    expect(sortOf(new URLSearchParams(''))).toEqual(DEFAULT_SORT);
    expect(sortOf(new URLSearchParams('sort=bogus&order=asc'))).toEqual(
      DEFAULT_SORT,
    );
    expect(sortOf(new URLSearchParams('sort=rounds&order=desc'))).toEqual({
      key: 'rounds',
      order: 'desc',
    });
    expect(sortOf(new URLSearchParams('sort=rounds'))).toEqual({
      key: 'rounds',
      order: 'asc',
    });
  });

  it('sorts ascending first, then descending on a second click', () => {
    const first = nextSort(DEFAULT_SORT, 'tokens');
    expect(first).toEqual({ key: 'tokens', order: 'asc' });
    expect(nextSort(first, 'tokens')).toEqual({ key: 'tokens', order: 'desc' });
    expect(nextSort(DEFAULT_SORT, 'cost')).toEqual({
      key: 'cost',
      order: 'asc',
    });
  });

  it('puts missing values last both ways and keeps the cost order on ties', () => {
    const rows = [
      row(1, 5, 90),
      row(2, 4, null),
      row(3, 3, 70),
      row(4, null, 90),
      row(5, 1, null),
    ];
    const numbers = (sorted: FeatureRow[]): number[] =>
      sorted.map((item) => item.number);
    expect(numbers(sortFeatures(rows, { key: 'score', order: 'asc' }))).toEqual(
      [3, 1, 4, 2, 5],
    );
    expect(
      numbers(sortFeatures(rows, { key: 'score', order: 'desc' })),
    ).toEqual([1, 4, 3, 2, 5]);
    expect(numbers(sortFeatures(rows, { key: 'cost', order: 'asc' }))).toEqual([
      5, 3, 2, 1, 4,
    ]);
    expect(
      numbers(sortFeatures(rows, { key: 'number', order: 'desc' })),
    ).toEqual([5, 4, 3, 2, 1]);
  });
});
