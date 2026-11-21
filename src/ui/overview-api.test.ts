import { describe, expect, it } from 'vitest';
import { overviewLoader } from './overview-api.ts';

const answering =
  (status: number, body: unknown, urls: string[] = []): typeof fetch =>
  (input) => {
    urls.push(typeof input === 'string' ? input : '');
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  };

describe('overviewLoader', () => {
  it('asks for the period in the browser time zone', async () => {
    const urls: string[] = [];
    const body = { status: 'unreachable', refreshSeconds: 10 };
    const load = overviewLoader(
      answering(503, body, urls),
      () => 'Europe/Paris',
    );
    await expect(load('30d')).resolves.toEqual(body);
    expect(urls).toEqual(['/api/overview?period=30d&tz=Europe%2FParis']);
  });

  it('gives nothing when the server does not answer or answers something else', async () => {
    const failing: typeof fetch = () =>
      Promise.reject(new TypeError('fetch failed'));
    await expect(overviewLoader(failing)('7d')).resolves.toBeUndefined();
    await expect(
      overviewLoader(answering(500, { error: 'boom' }))('7d'),
    ).resolves.toBeUndefined();
  });
});
