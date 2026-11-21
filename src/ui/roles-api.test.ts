import { describe, expect, it } from 'vitest';
import { rolesLoader } from './roles-api.ts';

describe('roles API', () => {
  it('asks for the roles of the period and project', async () => {
    const urls: string[] = [];
    const response = await rolesLoader(
      (input) => {
        urls.push(typeof input === 'string' ? input : '');
        return Promise.resolve(Response.json({ status: 'unreachable' }));
      },
      () => 'UTC',
    )({ period: 'all', project: '/work/app' });
    expect(response).toEqual({ status: 'unreachable' });
    expect(urls).toEqual([
      '/api/roles?period=all&tz=UTC&project=%2Fwork%2Fapp',
    ]);
  });

  it('gives nothing for an unexpected answer', async () => {
    await expect(
      rolesLoader(
        () => Promise.resolve(Response.json({ error: 'nope' })),
        () => 'UTC',
      )({ period: '7d', project: undefined }),
    ).resolves.toBeUndefined();
  });
});
