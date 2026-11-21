import { describe, expect, it } from 'vitest';
import { collectionLoader, collectionRefresher } from './git-host-api.ts';

const body = {
  status: 'ok',
  refreshSeconds: 10,
  collectedAt: '2026-03-12T11:00:00.000Z',
  failures: [],
};

describe('git host API', () => {
  it('asks for the collection status', async () => {
    const urls: string[] = [];
    const response = await collectionLoader((input) => {
      urls.push(typeof input === 'string' ? input : '');
      return Promise.resolve(Response.json(body));
    })();
    expect(response).toEqual(body);
    expect(urls).toEqual(['/api/git-host']);
  });

  it('starts a collection and gives the status once it ended', async () => {
    const requests: [string, string | undefined][] = [];
    const response = await collectionRefresher((input, init) => {
      requests.push([typeof input === 'string' ? input : '', init?.method]);
      return Promise.resolve(Response.json(body));
    })();
    expect(response).toEqual(body);
    expect(requests).toEqual([['/api/git-host/refresh', 'POST']]);
  });

  it('gives nothing for an unexpected answer or a network error', async () => {
    await expect(
      collectionLoader(() => Promise.resolve(Response.json({ error: 'x' })))(),
    ).resolves.toBeUndefined();
    await expect(
      collectionRefresher(() => Promise.reject(new Error('offline')))(),
    ).resolves.toBeUndefined();
  });
});
