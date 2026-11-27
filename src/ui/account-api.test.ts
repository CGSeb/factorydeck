import { describe, expect, it, vi } from 'vitest';
import {
  DATABASE_UNREACHABLE,
  SERVER_UNREACHABLE,
  meLoader,
  pageLeaver,
  signOuter,
} from './auth-api.ts';

const ADA = {
  id: 1,
  email: 'ada@example.test',
  name: 'Ada Lovelace',
  role: 'manager',
};

function answering(status: number, body?: unknown): typeof fetch {
  return () =>
    Promise.resolve(
      body === undefined
        ? new Response(status === 204 ? null : '', { status })
        : Response.json(body, { status }),
    );
}

const offline: typeof fetch = () => Promise.reject(new TypeError('offline'));

describe('me', () => {
  it('reads the account of the session from /api/auth/me', async () => {
    const urls: string[] = [];
    const result = await meLoader((input) => {
      urls.push(typeof input === 'string' ? input : '');
      return Promise.resolve(Response.json({ ...ADA, extra: true }));
    })();
    expect(result).toEqual({ status: 'account', account: ADA });
    expect(urls).toEqual(['/api/auth/me']);
  });

  it('reads a dev account', async () => {
    await expect(
      meLoader(answering(200, { ...ADA, role: 'dev' }))(),
    ).resolves.toEqual({ status: 'account', account: { ...ADA, role: 'dev' } });
  });

  it('reads a 401 as signed out', async () => {
    await expect(
      meLoader(answering(401, { error: 'Not signed in' }))(),
    ).resolves.toEqual({ status: 'signed-out' });
  });

  it('reads a 503 as the database unreachable', async () => {
    await expect(
      meLoader(answering(503, { status: 'unreachable', refreshSeconds: 10 }))(),
    ).resolves.toEqual({
      status: 'unreachable',
      message: DATABASE_UNREACHABLE,
    });
  });

  it.each([
    ['a network error', offline],
    ['a 500', answering(500, { error: 'boom' })],
    ['a 502 without a body', answering(502)],
    ['an unknown role', answering(200, { ...ADA, role: 'admin' })],
    ['a missing email', answering(200, { ...ADA, email: undefined })],
    ['a body that is not JSON', answering(200)],
    ['an array', answering(200, [ADA])],
  ])('reads %s as the server unreachable', async (_case, fetchImpl) => {
    await expect(meLoader(fetchImpl)()).resolves.toEqual({
      status: 'unreachable',
      message: SERVER_UNREACHABLE,
    });
  });
});

describe('sign-out', () => {
  it('posts to /api/auth/sign-out with no body and reads 204 as signed out', async () => {
    const requests: [string, RequestInit | undefined][] = [];
    const outcome = await signOuter((input, init) => {
      requests.push([typeof input === 'string' ? input : '', init]);
      return Promise.resolve(new Response(null, { status: 204 }));
    })();
    expect(outcome).toEqual({ status: 'signed-out' });
    expect(requests).toEqual([['/api/auth/sign-out', { method: 'POST' }]]);
  });

  it('reads a 503 as the database unreachable', async () => {
    await expect(
      signOuter(
        answering(503, { status: 'unreachable', refreshSeconds: 10 }),
      )(),
    ).resolves.toEqual({ status: 'failed', message: DATABASE_UNREACHABLE });
  });

  it.each([
    ['a network error', offline],
    ['a 200', answering(200, {})],
    ['a 401', answering(401, { error: 'Not signed in' })],
    ['a 500', answering(500, { error: 'boom' })],
  ])('reads %s as the server unreachable', async (_case, fetchImpl) => {
    await expect(signOuter(fetchImpl)()).resolves.toEqual({
      status: 'failed',
      message: SERVER_UNREACHABLE,
    });
  });
});

describe('leaving the page', () => {
  it('loads the path in place of the current history entry', () => {
    const replace = vi.fn<(url: string) => void>();
    pageLeaver({ replace })('/');
    expect(replace).toHaveBeenCalledExactlyOnceWith('/');
  });
});
