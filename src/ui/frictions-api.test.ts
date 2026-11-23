import { describe, expect, it } from 'vitest';
import type { FrictionsResponse } from '../frictions/types.ts';
import {
  frictionFiltersOf,
  frictionParams,
  frictionsHref,
  frictionsLoader,
  withoutFilter,
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

describe('the session and issue parameters', () => {
  it.each([
    ['', undefined, undefined],
    ['session=abc-123', 'abc-123', undefined],
    ['session=', undefined, undefined],
    ['session=%20abc', ' abc', undefined],
    ['session=a&session=b', 'a', undefined],
    ['issue=12&project=%2Fwork%2Fapp', undefined, 12],
    ['issue=0012&project=%2Fwork%2Fapp', undefined, 12],
    ['issue=12', undefined, undefined],
    ['issue=12&project=', undefined, undefined],
    ['issue=0&project=%2Fwork%2Fapp', undefined, undefined],
    ['issue=-4&project=%2Fwork%2Fapp', undefined, undefined],
    ['issue=4.5&project=%2Fwork%2Fapp', undefined, undefined],
    ['issue=%2312&project=%2Fwork%2Fapp', undefined, undefined],
    ['issue=99999999999999999999&project=%2Fwork%2Fapp', undefined, undefined],
    ['session=abc&issue=12&project=%2Fwork%2Fapp', 'abc', undefined],
  ])('reads ?%s as session %s and issue %s', (search, session, issue) => {
    const filters = frictionFiltersOf(new URLSearchParams(search));
    expect([filters.session, filters.issue]).toEqual([session, issue]);
  });

  it('writes them back, and drops them with the chip', () => {
    const issue = frictionFiltersOf(
      new URLSearchParams(
        'period=30d&project=%2Fwork%2Fapp&issue=12&kind=compaction',
      ),
    );
    expect(frictionParams(issue).toString()).toBe(
      'period=30d&project=%2Fwork%2Fapp&kind=compaction&issue=12',
    );
    expect(frictionParams(withoutFilter(issue)).toString()).toBe(
      'period=30d&project=%2Fwork%2Fapp&kind=compaction',
    );
  });

  it('links to the frictions of a session or an issue', () => {
    expect(frictionsHref({ period: 'all', session: 's 1' })).toBe(
      '/frictions?period=all&session=s+1',
    );
    expect(
      frictionsHref({ period: '7d', project: '/work/app', session: 's1' }),
    ).toBe('/frictions?period=7d&project=%2Fwork%2Fapp&session=s1');
    expect(
      frictionsHref({ period: '30d', project: '/work/app', issue: 12 }),
    ).toBe('/frictions?period=30d&project=%2Fwork%2Fapp&issue=12');
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
    await load({
      period: '7d',
      project: '/work/app',
      kind: undefined,
      issue: 12,
    });
    await load({
      period: 'all',
      project: undefined,
      kind: undefined,
      session: 's-1',
    });
    expect(urls).toEqual([
      '/api/frictions?period=30d&tz=Europe%2FParis&project=%2Fwork%2Fapp&kind=compaction',
      '/api/frictions?period=7d&tz=Europe%2FParis',
      '/api/frictions?period=7d&tz=Europe%2FParis&project=%2Fwork%2Fapp&issue=12',
      '/api/frictions?period=all&tz=Europe%2FParis&session=s-1',
    ]);
  });
});
