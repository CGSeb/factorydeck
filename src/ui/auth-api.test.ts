import { describe, expect, it } from 'vitest';
import {
  authStateLoader,
  DATABASE_UNREACHABLE,
  managerSetup,
  meLoader,
  SERVER_UNREACHABLE,
  signInSender,
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

  it('names the database when it answers 503', async () => {
    await expect(
      authStateLoader(() =>
        Promise.resolve(
          Response.json(
            { status: 'unreachable', refreshSeconds: 10 },
            { status: 503 },
          ),
        ),
      )(),
    ).resolves.toEqual({ unreachable: DATABASE_UNREACHABLE });
  });

  it('names the server when it does not answer', async () => {
    await expect(
      authStateLoader(() => Promise.reject(new TypeError('offline')))(),
    ).resolves.toEqual({ unreachable: SERVER_UNREACHABLE });
  });

  it.each([
    ['an unexpected body', Response.json({ setup: 'yes' })],
    ['a 500', Response.json({ error: 'Boom' }, { status: 500 })],
    ['a 502 without a body', new Response('', { status: 502 })],
    ['a body that is not JSON', new Response('<html>')],
  ])('names the server for %s', async (_, response) => {
    await expect(
      authStateLoader(() => Promise.resolve(response))(),
    ).resolves.toEqual({ unreachable: SERVER_UNREACHABLE });
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

const ACCOUNT = {
  id: 1,
  email: 'ada@example.test',
  name: 'Ada',
  role: 'manager',
} as const;

function answer(status: number, body?: unknown): typeof fetch {
  return () =>
    Promise.resolve(
      body === undefined
        ? new Response('', { status })
        : Response.json(body, { status }),
    );
}

describe('me', () => {
  it('reads the account of the session', async () => {
    const urls: string[] = [];
    const me = await meLoader((input) => {
      urls.push(typeof input === 'string' ? input : '');
      return Promise.resolve(Response.json(ACCOUNT));
    })();
    expect(me).toEqual({ status: 'account', account: ACCOUNT });
    expect(urls).toEqual(['/api/auth/me']);
  });

  it('is signed out on a 401', async () => {
    await expect(
      meLoader(answer(401, { error: 'Not signed in' }))(),
    ).resolves.toEqual({ status: 'signed-out' });
  });

  it('names the database on a 503', async () => {
    await expect(
      meLoader(answer(503, { status: 'unreachable', refreshSeconds: 10 }))(),
    ).resolves.toEqual({
      status: 'unreachable',
      message: DATABASE_UNREACHABLE,
    });
  });

  it.each([
    ['a network error', () => Promise.reject(new TypeError('offline'))],
    ['a 500', answer(500, { error: 'Boom' })],
    ['a 502 from a proxy', answer(502)],
    ['a body that is not an account', answer(200, { name: 'Ada' })],
    ['an unknown role', answer(200, { ...ACCOUNT, role: 'owner' })],
    ['an id that is not a number', answer(200, { ...ACCOUNT, id: '1' })],
  ] as [string, typeof fetch][])(
    'names the server for %s',
    async (_, fetchImpl) => {
      await expect(meLoader(fetchImpl)()).resolves.toEqual({
        status: 'unreachable',
        message: SERVER_UNREACHABLE,
      });
    },
  );
});

describe('sign in', () => {
  const INPUT_SIGN_IN = { email: ' Ada@Example.test', password: '' };

  it('posts the email and password as typed', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const outcome = await signInSender((input, init) => {
      calls.push([typeof input === 'string' ? input : '', init]);
      return Promise.resolve(Response.json(ACCOUNT));
    })(INPUT_SIGN_IN);
    expect(outcome).toEqual({ status: 'signed-in', account: ACCOUNT });
    expect(calls).toEqual([
      [
        '/api/auth/sign-in',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(INPUT_SIGN_IN),
        },
      ],
    ]);
  });

  it('gives the API message of a refusal', async () => {
    await expect(
      signInSender(answer(401, { error: 'Wrong email or password' }))(
        INPUT_SIGN_IN,
      ),
    ).resolves.toEqual({
      status: 'refused',
      message: 'Wrong email or password',
    });
  });

  it('gives the API message of a 429', async () => {
    await expect(
      signInSender(
        answer(429, { error: 'Too many attempts, try again in 15 minutes' }),
      )(INPUT_SIGN_IN),
    ).resolves.toEqual({
      status: 'refused',
      message: 'Too many attempts, try again in 15 minutes',
    });
  });

  it('names the database on a 503', async () => {
    await expect(
      signInSender(answer(503, { status: 'unreachable' }))(INPUT_SIGN_IN),
    ).resolves.toEqual({ status: 'failed', message: DATABASE_UNREACHABLE });
  });

  it.each([
    ['a network error', () => Promise.reject(new TypeError('offline'))],
    ['a 500 without a message', answer(500)],
    ['a 401 without a message', answer(401, {})],
    ['a 200 that is not an account', answer(200, {})],
  ] as [string, typeof fetch][])(
    'names the server for %s',
    async (_, fetchImpl) => {
      await expect(signInSender(fetchImpl)(INPUT_SIGN_IN)).resolves.toEqual({
        status: 'failed',
        message: SERVER_UNREACHABLE,
      });
    },
  );
});
