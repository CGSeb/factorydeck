import { describe, expect, it } from 'vitest';
import { DATABASE_UNREACHABLE, SERVER_UNREACHABLE } from './auth-api.ts';
import { tokenRemover, tokenSaver } from './git-host-token-api.ts';

function answering(status: number, body?: unknown): typeof fetch {
  return () =>
    Promise.resolve(
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
}

const failing: typeof fetch = () => Promise.reject(new Error('offline'));

const saved = {
  gitHost: 'github',
  tokenSet: true,
  tokenSetAt: '2026-03-01T10:00:00Z',
  tokenSetBy: { name: 'Ada' },
  defaultBranch: 'main',
};

describe('tokenSaver', () => {
  it('sends the trimmed token and the chosen host with PUT', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const fetchImpl: typeof fetch = (input, init) => {
      calls.push([
        input instanceof Request ? input.url : input.toString(),
        init,
      ]);
      return answering(200, saved)(input, init);
    };
    await tokenSaver(fetchImpl)(7, { token: 'secret', gitHost: 'gitlab' });
    expect(calls).toHaveLength(1);
    const [url, init] = calls[0] ?? [];
    expect(url).toBe('/api/admin/projects/7/git-host');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(typeof init?.body === 'string' ? init.body : '')).toEqual(
      {
        token: 'secret',
        gitHost: 'gitlab',
      },
    );
  });

  it('reads the stored token state and the default branch of a 200', async () => {
    await expect(
      tokenSaver(answering(200, saved))(1, { token: 't' }),
    ).resolves.toEqual({
      status: 'saved',
      token: {
        gitHost: 'github',
        tokenSet: true,
        tokenSetAt: '2026-03-01T10:00:00Z',
        tokenSetBy: { name: 'Ada' },
      },
      defaultBranch: 'main',
    });
    await expect(
      tokenSaver(answering(200, { ...saved, gitHost: null, tokenSetBy: null }))(
        1,
        { token: 't' },
      ),
    ).resolves.toMatchObject({
      status: 'saved',
      token: { gitHost: null, tokenSetBy: null },
    });
  });

  it('turns a 200 it cannot read into a failure', async () => {
    await expect(
      tokenSaver(answering(200, { ...saved, defaultBranch: 3 }))(1, {
        token: 't',
      }),
    ).resolves.toEqual({ status: 'failed', message: SERVER_UNREACHABLE });
  });

  it.each([
    [400, { error: 'Token is required', field: 'token' }, 'token'],
    [400, { error: 'Choose GitHub or GitLab', field: 'gitHost' }, 'gitHost'],
    [422, { error: 'Bad token', field: 'token' }, 'token'],
  ])('puts a %i refusal under its field', async (status, body, field) => {
    await expect(
      tokenSaver(answering(status, body))(1, { token: 't' }),
    ).resolves.toEqual({ status: 'invalid', field, message: body.error });
  });

  it('reads 404 as missing and the secret key 503 as no key', async () => {
    await expect(
      tokenSaver(answering(404, { error: 'Not found' }))(1, { token: 't' }),
    ).resolves.toEqual({ status: 'missing' });
    await expect(
      tokenSaver(
        answering(503, { error: 'No secret key: set FACTORYDECK_SECRET_KEY' }),
      )(1, { token: 't' }),
    ).resolves.toEqual({ status: 'no-key' });
  });

  it('shows the database, CLI and conflict failures without a field', async () => {
    const cases: [number, unknown, string][] = [
      [
        503,
        { status: 'unreachable', refreshSeconds: 10 },
        DATABASE_UNREACHABLE,
      ],
      [
        503,
        { error: 'gh not found on the server' },
        'gh not found on the server',
      ],
      [
        409,
        { error: 'The remote changed during the check: try again' },
        'The remote changed during the check: try again',
      ],
      [401, { error: 'Sign in' }, SERVER_UNREACHABLE],
      [500, undefined, SERVER_UNREACHABLE],
    ];
    for (const [status, body, message] of cases) {
      await expect(
        tokenSaver(answering(status, body))(1, { token: 't' }),
      ).resolves.toEqual({ status: 'failed', message });
    }
    await expect(tokenSaver(failing)(1, { token: 't' })).resolves.toEqual({
      status: 'failed',
      message: SERVER_UNREACHABLE,
    });
  });
});

describe('tokenRemover', () => {
  it('sends DELETE to the token of the project', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const fetchImpl: typeof fetch = (input, init) => {
      calls.push([
        input instanceof Request ? input.url : input.toString(),
        init,
      ]);
      return answering(204)(input, init);
    };
    await expect(tokenRemover(fetchImpl)(7)).resolves.toEqual({
      status: 'removed',
    });
    expect(calls.map(([url, init]) => [url, init?.method])).toEqual([
      ['/api/admin/projects/7/git-host/token', 'DELETE'],
    ]);
  });

  it('reads 404, 503, other answers and network errors', async () => {
    await expect(tokenRemover(answering(404, {}))(1)).resolves.toEqual({
      status: 'missing',
    });
    await expect(
      tokenRemover(answering(503, { status: 'unreachable' }))(1),
    ).resolves.toEqual({ status: 'failed', message: DATABASE_UNREACHABLE });
    await expect(tokenRemover(answering(401, {}))(1)).resolves.toEqual({
      status: 'failed',
      message: SERVER_UNREACHABLE,
    });
    await expect(tokenRemover(failing)(1)).resolves.toEqual({
      status: 'failed',
      message: SERVER_UNREACHABLE,
    });
  });
});
