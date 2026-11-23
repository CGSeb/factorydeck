import { describe, expect, it } from 'vitest';
import type { FrictionsResponse } from '../frictions/types.ts';
import {
  frictionFiltersOf,
  frictionParams,
  frictionsLoader,
} from './frictions-api.ts';

describe('frictionFiltersOf', () => {
  it.each([
    ['', undefined],
    ['kind=tool-error', 'tool-error'],
    ['kind=stop-blocked', 'stop-blocked'],
    ['kind=compaction', 'compaction'],
    ['kind=', undefined],
    ['kind=all', undefined],
    ['kind=Compaction', undefined],
    ['kind=tool_error', undefined],
    ['kind=compaction&kind=tool-error', 'compaction'],
    ['kind=nope&kind=tool-error', undefined],
  ])('reads ?%s as the kind %s', (search, kind) => {
    expect(frictionFiltersOf(new URLSearchParams(search)).kind).toBe(kind);
  });

  it('reads the period and project next to the kind', () => {
    expect(
      frictionFiltersOf(
        new URLSearchParams('period=30d&project=%2Fwork%2Fapp&kind=compaction'),
      ),
    ).toEqual({ period: '30d', project: '/work/app', kind: 'compaction' });
    expect(frictionFiltersOf(new URLSearchParams('period=year'))).toEqual({
      period: '7d',
      project: undefined,
      kind: undefined,
    });
  });
});

describe('frictionParams', () => {
  it('writes the kind, and removes it for All', () => {
    expect(
      frictionParams({
        period: '7d',
        project: '/work/app',
        kind: 'stop-blocked',
      }).toString(),
    ).toBe('period=7d&project=%2Fwork%2Fapp&kind=stop-blocked');
    expect(
      frictionParams({
        period: 'all',
        project: undefined,
        kind: undefined,
      }).toString(),
    ).toBe('period=all');
  });
});

describe('frictionsLoader', () => {
  it('asks the API for the period, time zone, project and kind', async () => {
    const urls: string[] = [];
    const body: FrictionsResponse = {
      status: 'unreachable',
      refreshSeconds: 5,
    };
    const load = frictionsLoader(
      (input) => {
        urls.push(input instanceof Request ? input.url : input.toString());
        return Promise.resolve(new Response(JSON.stringify(body)));
      },
      () => 'Europe/Paris',
    );
    await expect(
      load({ period: '30d', project: '/work/app', kind: 'compaction' }),
    ).resolves.toEqual(body);
    await load({ period: '7d', project: undefined, kind: undefined });
    expect(urls).toEqual([
      '/api/frictions?period=30d&tz=Europe%2FParis&project=%2Fwork%2Fapp&kind=compaction',
      '/api/frictions?period=7d&tz=Europe%2FParis',
    ]);
  });
});
