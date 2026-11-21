import { describe, expect, it } from 'vitest';
import { factoryLoader, projectDeleter } from './factory-api.ts';

describe('factory API', () => {
  it('asks for the factory status', async () => {
    const urls: string[] = [];
    const body = {
      status: 'ok',
      refreshSeconds: 10,
      hasSessions: false,
      missing: [],
    };
    const response = await factoryLoader((input) => {
      urls.push(typeof input === 'string' ? input : '');
      return Promise.resolve(Response.json(body));
    })();
    expect(response).toEqual(body);
    expect(urls).toEqual(['/api/projects/factory']);
  });

  it('gives nothing for an unexpected answer', async () => {
    await expect(
      factoryLoader(() => Promise.resolve(Response.json({ error: 'nope' })))(),
    ).resolves.toBeUndefined();
  });

  it.each([
    [200, 'deleted'],
    [409, 'has-factory'],
    [404, 'not-found'],
    [500, 'failed'],
    [503, 'failed'],
  ] as const)(
    'deletes a project and reads HTTP %i as %s',
    async (code, outcome) => {
      const requests: [string, string | undefined][] = [];
      const result = await projectDeleter((input, init) => {
        requests.push([typeof input === 'string' ? input : '', init?.method]);
        return Promise.resolve(Response.json({}, { status: code }));
      })('/work/old app');
      expect(result).toBe(outcome);
      expect(requests).toEqual([
        ['/api/projects?project=%2Fwork%2Fold+app', 'DELETE'],
      ]);
    },
  );

  it('reads a network failure as failed', async () => {
    await expect(
      projectDeleter(() => Promise.reject(new Error('offline')))('/work/app'),
    ).resolves.toBe('failed');
  });
});
