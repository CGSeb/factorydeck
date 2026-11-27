import { describe, expect, it } from 'vitest';
import {
  authStateLoader,
  DATABASE_UNREACHABLE,
  managerSetup,
  SERVER_UNREACHABLE,
} from './auth-api.ts';

const INPUT = {
  code: 'k7mq2xrd',
  email: 'ada@example.test',
  name: 'Ada',
  password: 'a long passphrase',
};

describe('auth state', () => {
  it.each([true, false])('reads setup: %s', async (setup) => {
    const urls: string[] = [];
    const state = await authStateLoader((input) => {
      urls.push(typeof input === 'string' ? input : '');
      return Promise.resolve(Response.json({ setup }));
    })();
    expect(state).toEqual({ setup });
    expect(urls).toEqual(['/api/auth/state']);
  });

  it('gives nothing when the database does not answer', async () => {
    await expect(
      authStateLoader(() =>
        Promise.resolve(
          Response.json(
            { status: 'unreachable', refreshSeconds: 10 },
            { status: 503 },
          ),
        ),
      )(),
    ).resolves.toBeUndefined();
  });

  it('gives nothing when the server does not answer', async () => {
    await expect(
      authStateLoader(() => Promise.reject(new TypeError('offline')))(),
    ).resolves.toBeUndefined();
  });

  it('gives nothing for an unexpected body', async () => {
    await expect(
      authStateLoader(() => Promise.resolve(Response.json({ setup: 'yes' })))(),
    ).resolves.toBeUndefined();
  });
});

describe('manager setup', () => {
  function answering(status: number, body?: unknown): typeof fetch {
    return () =>
      Promise.resolve(
        body === undefined
          ? new Response('', { status })
          : Response.json(body, { status }),
      );
  }

  it('posts the fields as JSON and reads 201 as created', async () => {
    const requests: [string, RequestInit | undefined][] = [];
    const outcome = await managerSetup((input, init) => {
      requests.push([typeof input === 'string' ? input : '', init]);
      return Promise.resolve(
        Response.json({ id: 1, email: 'ada@example.test' }, { status: 201 }),
      );
    })(INPUT);
    expect(outcome).toEqual({ status: 'created' });
    expect(requests).toHaveLength(1);
    const [url, init] = requests[0] ?? [];
    expect(url).toBe('/api/auth/setup');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'content-type': 'application/json' });
    expect(init?.body).toBe(JSON.stringify(INPUT));
  });

  it.each([
    [403, 'Wrong setup code'],
    [409, 'Already set up'],
  ])('shows the message of a %i under the form', async (status, error) => {
    await expect(
      managerSetup(answering(status, { error }))(INPUT),
    ).resolves.toEqual({ status: 'failed', message: error });
  });

  it.each(['email', 'name', 'password'] as const)(
    'puts a 400 on %s under its field',
    async (field) => {
      await expect(
        managerSetup(answering(400, { error: 'Bad value', field }))(INPUT),
      ).resolves.toEqual({ status: 'invalid', field, message: 'Bad value' });
    },
  );

  it('puts a 400 on an unknown field under the form', async () => {
    await expect(
      managerSetup(answering(400, { error: 'Bad value', field: 'age' }))(INPUT),
    ).resolves.toEqual({ status: 'failed', message: 'Bad value' });
  });

  it('reads a network error as the server unreachable', async () => {
    await expect(
      managerSetup(() => Promise.reject(new TypeError('offline')))(INPUT),
    ).resolves.toEqual({ status: 'failed', message: SERVER_UNREACHABLE });
  });

  it('reads a 503 as the database unreachable', async () => {
    await expect(
      managerSetup(
        answering(503, { status: 'unreachable', refreshSeconds: 10 }),
      )(INPUT),
    ).resolves.toEqual({ status: 'failed', message: DATABASE_UNREACHABLE });
  });

  it('reads an answer without a message as the server unreachable', async () => {
    await expect(managerSetup(answering(502))(INPUT)).resolves.toEqual({
      status: 'failed',
      message: SERVER_UNREACHABLE,
    });
  });
});
