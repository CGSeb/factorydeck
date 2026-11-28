import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type FakeContext,
  fakeContext,
  removeContext,
  runIn,
} from './test/fake-context.ts';
import {
  type FakeServer,
  type Reply,
  closedOrigin,
  startFakeServer,
} from './test/fake-server.ts';

const ACCOUNT = {
  id: 7,
  email: 'ada@example.test',
  name: 'Ada',
  role: 'dev',
};
const PENDING: Reply = { status: 202, body: { status: 'pending' } };
const GONE: Reply = {
  status: 410,
  body: {
    error: 'This login is no longer valid. Run factorydeck login again.',
  },
};

let server: FakeServer;
let context: FakeContext;

function started(overrides: Record<string, unknown> = {}): Reply {
  return {
    status: 200,
    body: {
      deviceCode: 'device-1',
      userCode: 'WDJB-MJHT',
      verificationUrl: `${server.origin}/cli?code=WDJB-MJHT`,
      expiresIn: 600,
      interval: 5,
      ...overrides,
    },
  };
}

function approved(token = 'fdk_new'): Reply {
  return { status: 200, body: { token, account: ACCOUNT } };
}

async function savedFile(): Promise<unknown> {
  return JSON.parse(await readFile(context.credentials, 'utf8'));
}

beforeEach(async () => {
  server = await startFakeServer();
  context = await fakeContext();
});

afterEach(async () => {
  await server.close();
  await removeContext(context);
});

describe('factorydeck login', () => {
  it('shows the code, opens the browser, polls every 5 seconds and saves the token', async () => {
    server.route('POST /api/cli/login', [started()]);
    server.route('POST /api/cli/login/poll', [PENDING, PENDING, approved()]);

    const ran = await runIn(context, [
      'login',
      `  ${server.origin}/some/path/?q=1 `,
    ]);

    expect(ran).toEqual({
      code: 0,
      stdout: [
        `Open ${server.origin}/cli?code=WDJB-MJHT and check the code WDJB-MJHT.`,
        `Logged in to ${server.origin} as Ada (ada@example.test).`,
      ],
      stderr: [],
    });
    expect(server.received[0]?.body).toEqual({ machine: 'test-laptop' });
    expect(server.received.slice(1).map((r) => r.body)).toEqual([
      { deviceCode: 'device-1' },
      { deviceCode: 'device-1' },
      { deviceCode: 'device-1' },
    ]);
    expect(context.sleeps).toEqual([5000, 5000, 5000]);
    expect(context.launched).toEqual([
      ['open', [`${server.origin}/cli?code=WDJB-MJHT`]],
    ]);
    expect(await savedFile()).toEqual({
      version: 1,
      servers: {
        [server.origin]: {
          token: 'fdk_new',
          account: ACCOUNT,
          machine: 'test-laptop',
          loggedInAt: '2026-01-02T03:04:20.000Z',
        },
      },
    });
    const text = await readFile(context.credentials, 'utf8');
    expect(text).toBe(`${JSON.stringify(await savedFile(), null, 2)}\n`);
  });

  it('sends the host name as the machine name', async () => {
    context.hostname = `  ${'é'.repeat(90)}  `;
    server.route('POST /api/cli/login', [{ status: 404 }]);
    await runIn(context, ['login', server.origin]);
    expect(server.received[0]?.body).toEqual({ machine: 'é'.repeat(80) });
    context.hostname = '   ';
    await runIn(context, ['login', server.origin]);
    expect(server.received[1]?.body).toEqual({ machine: 'unknown' });
  });

  it('uses the interval of the server, never less than 5 seconds', async () => {
    server.route('POST /api/cli/login', [started({ interval: 1 })]);
    server.route('POST /api/cli/login/poll', [PENDING, approved()]);
    await runIn(context, ['login', server.origin]);
    expect(context.sleeps).toEqual([5000, 5000]);

    server.route('POST /api/cli/login', [started({ interval: 8 })]);
    server.route('POST /api/cli/login/poll', [PENDING, approved()]);
    context.sleeps.length = 0;
    await runIn(context, ['login', server.origin]);
    expect(context.sleeps).toEqual([8000, 8000]);
  });

  it('waits one more interval after a 429, and keeps polling through a 503', async () => {
    server.route('POST /api/cli/login', [started()]);
    server.route('POST /api/cli/login/poll', [
      { status: 429, body: { error: 'Slow down' } },
      { status: 503, body: { error: 'Down' } },
      approved(),
    ]);
    const ran = await runIn(context, ['login', server.origin]);
    expect(ran.code).toBe(0);
    expect(context.sleeps).toEqual([5000, 10000, 5000]);
  });

  it('prints the cancelled message when the login is cancelled', async () => {
    server.route('POST /api/cli/login', [started()]);
    server.route('POST /api/cli/login/poll', [PENDING, GONE]);
    const ran = await runIn(context, ['login', server.origin]);
    expect(ran.code).toBe(1);
    expect(ran.stderr).toEqual([
      `Login cancelled or expired. Run factorydeck login ${server.origin} again.`,
    ]);
    await expect(readFile(context.credentials)).rejects.toThrow(/ENOENT/);
  });

  it('stops polling at expiresIn', async () => {
    server.route('POST /api/cli/login', [started({ expiresIn: 30 })]);
    server.route('POST /api/cli/login/poll', [PENDING]);
    const ran = await runIn(context, ['login', server.origin]);
    expect(ran.code).toBe(1);
    expect(ran.stderr).toEqual([
      `Login cancelled or expired. Run factorydeck login ${server.origin} again.`,
    ]);
    expect(server.received.length - 1).toBe(5);
  });

  it('says when the server cannot be reached', async () => {
    const origin = await closedOrigin();
    const ran = await runIn(context, ['login', origin]);
    expect(ran).toEqual({
      code: 1,
      stdout: [],
      stderr: [`Could not reach ${origin}.`],
    });
  });

  it('counts a request with no answer within the timeout as unreachable', async () => {
    context.timeoutMs = 100;
    server.route('POST /api/cli/login', () => 'hang');
    const ran = await runIn(context, ['login', server.origin]);
    expect(ran.stderr).toEqual([`Could not reach ${server.origin}.`]);
    expect(ran.code).toBe(1);
  });

  it('keeps polling through a network error until the login expires', async () => {
    context.timeoutMs = 100;
    server.route('POST /api/cli/login', [started({ expiresIn: 12 })]);
    server.route('POST /api/cli/login/poll', () => 'hang');
    const ran = await runIn(context, ['login', server.origin]);
    expect(ran.code).toBe(1);
    expect(server.received.length - 1).toBe(2);
    expect(ran.stderr[0]).toMatch(/^Login cancelled or expired/);
  });

  it.each([
    [{ status: 404 }, 'is not a FactoryDeck server with CLI login.'],
    [
      {
        status: 503,
        body: { error: 'Too many pending logins, try again later' },
      },
      'Too many pending logins, try again later',
    ],
    [
      { status: 302, headers: { location: 'https://elsewhere.test/' } },
      'Unexpected answer from ORIGIN (HTTP 302).',
    ],
    [{ status: 500 }, 'Unexpected answer from ORIGIN (HTTP 500).'],
    [
      { status: 200, body: { nothing: true } },
      'Unexpected answer from ORIGIN (HTTP 200).',
    ],
  ] satisfies [Reply, string][])(
    'fails on a start answered %j',
    async (reply, message) => {
      server.route('POST /api/cli/login', [reply]);
      const ran = await runIn(context, ['login', server.origin]);
      expect(ran.code).toBe(1);
      const expected = message.startsWith('is not')
        ? `${server.origin} ${message}`
        : message.replace('ORIGIN', server.origin);
      expect(ran.stderr).toEqual([expected]);
      expect(server.received).toHaveLength(1);
    },
  );

  it('logs the old connection out once the new token arrives, and replaces it', async () => {
    const other = {
      token: 'fdk_other',
      account: ACCOUNT,
      machine: 'm',
      loggedInAt: 'x',
    };
    await mkdir(context.home, { recursive: true });
    await writeFile(
      context.credentials,
      JSON.stringify({
        version: 1,
        servers: {
          [server.origin]: { ...other, token: 'fdk_old' },
          'https://other.example.test': other,
        },
      }),
    );
    server.route('POST /api/cli/login', [started()]);
    server.route('POST /api/cli/login/poll', [approved('fdk_new')]);
    server.route('POST /api/cli/logout', [{ status: 204 }]);
    const ran = await runIn(context, ['login', server.origin]);
    expect(ran.code).toBe(0);
    expect(
      server.received.map((r) => `${r.method} ${r.path} ${r.authorization}`),
    ).toEqual([
      'POST /api/cli/login undefined',
      'POST /api/cli/login/poll undefined',
      'POST /api/cli/logout Bearer fdk_old',
    ]);
    expect(await savedFile()).toMatchObject({
      servers: {
        [server.origin]: { token: 'fdk_new' },
        'https://other.example.test': other,
      },
    });
  });

  it('keeps the old token when the new login fails', async () => {
    await mkdir(context.home, { recursive: true });
    const before = JSON.stringify({
      version: 1,
      servers: {
        [server.origin]: {
          token: 'fdk_old',
          account: ACCOUNT,
          machine: 'm',
          loggedInAt: 'x',
        },
      },
    });
    await writeFile(context.credentials, before);
    server.route('POST /api/cli/login', [started()]);
    server.route('POST /api/cli/login/poll', [GONE]);
    await runIn(context, ['login', server.origin]);
    expect(await readFile(context.credentials, 'utf8')).toBe(before);
  });

  it('opens nothing for a verification URL that is not http or https', async () => {
    server.route('POST /api/cli/login', [
      started({ verificationUrl: 'file:///etc/passwd' }),
    ]);
    server.route('POST /api/cli/login/poll', [approved()]);
    await runIn(context, ['login', server.origin]);
    expect(context.launched).toEqual([]);
  });

  it('keeps a server another login saved while this one waited', async () => {
    const other = {
      token: 'fdk_b',
      account: ACCOUNT,
      machine: 'm',
      loggedInAt: 'x',
    };
    server.route('POST /api/cli/login', [started()]);
    let polls = 0;
    server.route('POST /api/cli/login/poll', () => {
      polls += 1;
      if (polls > 1) return approved();
      mkdirSync(context.home, { recursive: true });
      writeFileSync(
        context.credentials,
        JSON.stringify({
          version: 1,
          servers: { 'https://b.example.test': other },
        }),
      );
      return PENDING;
    });
    expect((await runIn(context, ['login', server.origin])).code).toBe(0);
    expect(await savedFile()).toMatchObject({
      servers: {
        'https://b.example.test': other,
        [server.origin]: { token: 'fdk_new' },
      },
    });
  });
});
