import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
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

let server: FakeServer;
let context: FakeContext;

function entry(token: string, name = 'Ada', machine = 'test-laptop'): object {
  return {
    token,
    account: {
      id: 7,
      email: `${name.toLowerCase()}@example.test`,
      name,
      role: 'dev',
    },
    machine,
    loggedInAt: '2026-01-02T03:04:05.000Z',
  };
}

async function saveServers(servers: Record<string, object>): Promise<string> {
  await mkdir(context.home, { recursive: true });
  const text = JSON.stringify({ version: 1, servers }, null, 2);
  await writeFile(context.credentials, text);
  return text;
}

async function savedOrigins(): Promise<string[]> {
  const saved = JSON.parse(await readFile(context.credentials, 'utf8')) as {
    servers: Record<string, unknown>;
  };
  return Object.keys(saved.servers);
}

beforeEach(async () => {
  server = await startFakeServer();
  context = await fakeContext();
});

afterEach(async () => {
  await server.close();
  await removeContext(context);
});

describe('factorydeck logout', () => {
  it('ends the connection, forgets the token and keeps the other servers', async () => {
    await saveServers({
      [server.origin]: entry('fdk_a'),
      'https://b.example.test': entry('fdk_b'),
    });
    server.route('POST /api/cli/logout', [{ status: 204 }]);
    const ran = await runIn(context, ['logout', `${server.origin}/`]);
    expect(ran).toEqual({
      code: 0,
      stdout: [`Logged out of ${server.origin}.`],
      stderr: [],
    });
    expect(server.received[0]?.authorization).toBe('Bearer fdk_a');
    expect(await savedOrigins()).toEqual(['https://b.example.test']);
  });

  it('counts a refused token as logged out', async () => {
    await saveServers({ [server.origin]: entry('fdk_a') });
    server.route('POST /api/cli/logout', [
      { status: 401, body: { error: 'Run factorydeck login' } },
    ]);
    const ran = await runIn(context, ['logout', server.origin]);
    expect(ran).toEqual({
      code: 0,
      stdout: [`Logged out of ${server.origin}.`],
      stderr: [],
    });
    expect(await savedOrigins()).toEqual([]);
  });

  it.each([
    [
      'answers 500',
      (): Promise<string> => Promise.resolve(server.origin),
      { status: 500 },
    ],
    ['cannot be reached', closedOrigin, undefined],
  ] satisfies [string, () => Promise<string>, Reply | undefined][])(
    'forgets the token when the server %s, and says so',
    async (_, originOf, reply) => {
      const origin = await originOf();
      await saveServers({ [origin]: entry('fdk_a') });
      if (reply !== undefined) server.route('POST /api/cli/logout', [reply]);
      const ran = await runIn(context, ['logout', origin]);
      expect(ran).toEqual({
        code: 1,
        stdout: [],
        stderr: [
          `Logged out of ${origin} on this machine; could not reach it to end the connection.`,
        ],
      });
      expect(await savedOrigins()).toEqual([]);
    },
  );

  it('says when there is no token for the server', async () => {
    const ran = await runIn(context, ['logout', server.origin]);
    expect(ran).toEqual({
      code: 0,
      stdout: [`Not logged in to ${server.origin}.`],
      stderr: [],
    });
    expect(server.received).toEqual([]);
  });
});

describe('factorydeck status', () => {
  async function threeServers(): Promise<{ text: string; down: string }> {
    const down = await closedOrigin();
    const refused = server.origin.replace('127.0.0.1', 'localhost');
    server.route('GET /api/cli/me', (received) =>
      received.authorization === 'Bearer fdk_ok'
        ? { status: 200, body: { account: {}, machine: 'test-laptop' } }
        : { status: 401, body: { error: 'Run factorydeck login' } },
    );
    const text = await saveServers({
      [server.origin]: entry('fdk_ok'),
      [down]: entry('fdk_down', 'Bo', 'desk'),
      [refused]: entry('fdk_refused'),
    });
    return { text, down };
  }

  it('checks each server in parallel and prints one line per server, sorted by origin', async () => {
    const { down } = await threeServers();
    const refused = server.origin.replace('127.0.0.1', 'localhost');
    const ran = await runIn(context, ['status']);
    expect(ran.code).toBe(1);
    expect(ran.stderr).toEqual([]);
    expect(ran.stdout).toEqual(
      [
        `${down}  Bo bo@example.test  desk  unreachable`,
        `${server.origin}  Ada ada@example.test  test-laptop  ok`,
        `${refused}  Ada ada@example.test  test-laptop  token refused`,
      ].sort(),
    );
  });

  it('never rewrites the file, and keeps a refused token', async () => {
    const { text } = await threeServers();
    const before = await stat(context.credentials);
    await runIn(context, ['status']);
    expect(await readFile(context.credentials, 'utf8')).toBe(text);
    expect((await stat(context.credentials)).mtimeMs).toBe(before.mtimeMs);
  });

  it('pads the columns only on a terminal', async () => {
    server.route('GET /api/cli/me', [{ status: 200, body: {} }]);
    const second = server.origin.replace('127.0.0.1', 'localhost');
    await saveServers({
      [server.origin]: entry('fdk_a', 'Ada', 'm1'),
      [second]: entry('fdk_b', 'Bo', 'machine-2'),
    });
    context.output.terminal = true;
    const ran = await runIn(context, ['status']);
    expect(ran.code).toBe(0);
    const width = second.length;
    expect(ran.stdout).toEqual([
      `${server.origin.padEnd(width)}  Ada ada@example.test  m1         ok`,
      `${second}  Bo bo@example.test    machine-2  ok`,
    ]);
  });

  it.each([
    [{ status: 503 }, 'unreachable'],
    [{ status: 500 }, 'unexpected answer (HTTP 500)'],
    [
      { status: 301, headers: { location: '/' } },
      'unexpected answer (HTTP 301)',
    ],
  ] satisfies [Reply, string][])(
    'maps an answer %j to %s',
    async (reply, result) => {
      server.route('GET /api/cli/me', [reply]);
      await saveServers({ [server.origin]: entry('fdk_a') });
      const ran = await runIn(context, ['status']);
      expect(ran).toEqual({
        code: 1,
        stdout: [
          `${server.origin}  Ada ada@example.test  test-laptop  ${result}`,
        ],
        stderr: [],
      });
    },
  );

  it('says when no server has a token', async () => {
    expect(await runIn(context, ['status'])).toEqual({
      code: 0,
      stdout: ['Not logged in. Run factorydeck login <url>.'],
      stderr: [],
    });
  });

  it('shows only the server of --server', async () => {
    server.route('GET /api/cli/me', [{ status: 200, body: {} }]);
    await saveServers({
      [server.origin]: entry('fdk_a'),
      'https://b.example.test': entry('fdk_b'),
    });
    const ran = await runIn(context, [
      'status',
      '--server',
      server.origin.toUpperCase(),
    ]);
    expect(ran.stdout).toEqual([
      `${server.origin}  Ada ada@example.test  test-laptop  ok`,
    ]);
    const missing = await runIn(context, [
      'status',
      '--server',
      'https://c.example.test',
    ]);
    expect(missing).toEqual({
      code: 0,
      stdout: ['Not logged in to https://c.example.test.'],
      stderr: [],
    });
  });
});
