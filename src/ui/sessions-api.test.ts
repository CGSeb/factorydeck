import { describe, expect, it } from 'vitest';
import { sessionLoader, sessionsLoader } from './sessions-api.ts';

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

describe('sessionsLoader', () => {
  it('asks for the filters in the browser time zone', async () => {
    const urls: string[] = [];
    const body = { status: 'unreachable', refreshSeconds: 10 };
    const load = sessionsLoader(answering(503, body, urls), () => 'UTC');
    await expect(
      load({ period: 'all', project: '/work/app', state: 'waiting' }, 100),
    ).resolves.toEqual(body);
    await load({ period: '7d', project: undefined, state: undefined }, 50);
    expect(urls).toEqual([
      '/api/sessions?period=all&tz=UTC&project=%2Fwork%2Fapp&state=waiting&limit=100',
      '/api/sessions?period=7d&tz=UTC&limit=50',
    ]);
  });

  it('gives nothing when the server does not answer or answers something else', async () => {
    const failing: typeof fetch = () =>
      Promise.reject(new TypeError('fetch failed'));
    const filters = {
      period: '7d',
      project: undefined,
      state: undefined,
    } as const;
    await expect(sessionsLoader(failing)(filters, 50)).resolves.toBeUndefined();
    await expect(
      sessionsLoader(answering(400, { error: 'bad' }))(filters, 50),
    ).resolves.toBeUndefined();
  });
});

describe('sessionLoader', () => {
  it('asks for one session and keeps a not-found answer', async () => {
    const urls: string[] = [];
    const body = { status: 'not-found', refreshSeconds: 10 };
    await expect(
      sessionLoader(answering(404, body, urls))('a/b'),
    ).resolves.toEqual(body);
    expect(urls).toEqual(['/api/sessions/a%2Fb']);
  });

  it('gives nothing for an answer it does not know', async () => {
    await expect(
      sessionLoader(answering(500, { error: 'boom' }))('x'),
    ).resolves.toBeUndefined();
  });
});
