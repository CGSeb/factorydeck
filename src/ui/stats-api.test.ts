import { describe, expect, it } from 'vitest';
import { waitingLoader } from './stats-api.ts';

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
