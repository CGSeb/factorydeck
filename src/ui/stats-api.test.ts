import { describe, expect, it } from 'vitest';
import {
  autonomyLoader,
  bugStatsLoader,
  flowLoader,
  qualityLoader,
  waitingLoader,
} from './stats-api.ts';

function fetchOf(body: unknown, urls: string[]): typeof fetch {
  return (input) => {
    urls.push(typeof input === 'string' ? input : '');
    return Promise.resolve(new Response(JSON.stringify(body)));
  };
}

describe('waitingLoader', () => {
  const ok = {
    status: 'ok',
    updatedAt: null,
    refreshSeconds: 10,
    waiting: { issues: [], projects: [] },
  };

  it('asks for every project, or for the one selected', async () => {
    const urls: string[] = [];
    const load = waitingLoader(fetchOf(ok, urls));
    await expect(load(undefined)).resolves.toEqual(ok);
    await load('/work/app');
    expect(urls).toEqual([
      '/api/stats/waiting',
      '/api/stats/waiting?project=%2Fwork%2Fapp',
    ]);
  });

  it('answers nothing when the server cannot be read', async () => {
    const load = waitingLoader(() => Promise.reject(new Error('offline')));
    await expect(load(undefined)).resolves.toBeUndefined();
  });
});

describe('stats loaders', () => {
  const filters = { period: '7d', project: '/work/app' } as const;

  it('asks for one kind, or for every kind without one', async () => {
    const urls: string[] = [];
    const fetchImpl = fetchOf({ status: 'ok', refreshSeconds: 10 }, urls);
    const utc = (): string => 'UTC';
    await autonomyLoader(fetchImpl, utc)(filters, 'bug');
    await qualityLoader(fetchImpl, utc)(filters, 'feature');
    await flowLoader(fetchImpl, utc)(filters, null);
    await flowLoader(fetchImpl, utc)(filters);
    await bugStatsLoader(fetchImpl, utc)(filters);
    expect(urls).toEqual([
      '/api/stats/autonomy?period=7d&tz=UTC&project=%2Fwork%2Fapp&kind=bug',
      '/api/stats/quality?period=7d&tz=UTC&project=%2Fwork%2Fapp&kind=feature',
      '/api/stats/flow?period=7d&tz=UTC&project=%2Fwork%2Fapp',
      '/api/stats/flow?period=7d&tz=UTC&project=%2Fwork%2Fapp',
      '/api/stats/bugs?period=7d&tz=UTC&project=%2Fwork%2Fapp',
    ]);
  });
});
