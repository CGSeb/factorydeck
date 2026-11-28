import { describe, expect, it } from 'vitest';
import { factoryLoader } from './factory-api.ts';

describe('factory API', () => {
  it('asks for the factory status', async () => {
    const urls: string[] = [];
    const body = {
      status: 'ok',
      refreshSeconds: 10,
      hasSessions: false,
      missing: [],
      projects: [],
      bugTickets: [],
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
});
