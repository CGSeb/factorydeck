import { describe, expect, it } from 'vitest';
import type { FeatureListResponse } from '../features/types.ts';
import type { IssueKind } from '../git-host/kind.ts';
import { featureList, featuresResponse } from './feature-fixtures.ts';
import {
  type LoadFeatures,
  featureLoader,
  bugsPath,
  featurePath,
  featuresLoader,
  loadKindList,
} from './features-api.ts';

function recorder(urls: string[], body: unknown): typeof fetch {
  return (input) => {
    urls.push(typeof input === 'string' ? input : '');
    return Promise.resolve(Response.json(body));
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

  it('asks for the issues of a kind', async () => {
    const urls: string[] = [];
    const load = featuresLoader(
      recorder(urls, { status: 'unreachable' }),
      () => 'UTC',
    );
    await load({ period: '7d', project: undefined }, 'bug');
    await load({ period: '7d', project: undefined }, null);
    expect(urls).toEqual([
      '/api/features?period=7d&tz=UTC&kind=bug',
      '/api/features?period=7d&tz=UTC',
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

  it('links a bug to its bug page, and a feature or an issue of no kind to its feature page', () => {
    const issue = { project: '/work/app', number: 7 };
    const period = { period: '7d' as const };
    expect(featurePath({ ...issue, kind: 'bug' }, period)).toBe(
      '/bugs/7?project=%2Fwork%2Fapp&period=7d',
    );
    expect(featurePath({ ...issue, kind: 'feature' }, period)).toBe(
      '/features/7?project=%2Fwork%2Fapp&period=7d',
    );
    expect(featurePath({ ...issue, kind: null }, period)).toBe(
      '/features/7?project=%2Fwork%2Fapp&period=7d',
    );
  });

  it('links the bugs list with the period and the project', () => {
    expect(bugsPath({ period: 'all', project: '/work/app' })).toBe(
      '/bugs?period=all&project=%2Fwork%2Fapp',
    );
    expect(bugsPath({ period: '7d', project: undefined })).toBe(
      '/bugs?period=7d',
    );
  });
});

describe('loadKindList', () => {
  const filters = { period: '7d' as const, project: undefined };

  function loader(bugTickets: boolean): {
    load: LoadFeatures;
    kinds: (IssueKind | null | undefined)[];
  } {
    const kinds: (IssueKind | null | undefined)[] = [];
    return {
      kinds,
      load: (_filters, kind) => {
        kinds.push(kind);
        const response: FeatureListResponse = featuresResponse(
          featureList([], null, { bugTickets }),
        );
        return Promise.resolve(response);
      },
    };
  }

  it('loads the kind once when the selection has bug tickets', async () => {
    const { load, kinds } = loader(true);
    await loadKindList(load, filters, 'bug');
    expect(kinds).toEqual(['bug']);
  });

  it('loads every issue again when the selection has no bug tickets', async () => {
    const { load, kinds } = loader(false);
    const response = await loadKindList(load, filters, 'bug');
    expect(kinds).toEqual(['bug', undefined]);
    expect(response?.status).toBe('ok');
  });

  it('loads once without a kind', async () => {
    const { load, kinds } = loader(false);
    await loadKindList(load, filters, null);
    expect(kinds).toEqual([null]);
  });
});
