import { describe, expect, it } from 'vitest';
import { DATABASE_UNREACHABLE, SERVER_UNREACHABLE } from './auth-api.ts';
import { cliLoginDecider, cliLoginReader } from './cli-api.ts';

const LOGIN = {
  machine: 'laptop',
  userCode: 'WDJB-MJHT',
  account: { name: 'Ada', email: 'ada@example.test' },
};

function answering(status: number, body?: unknown) {
  const calls: { path: string; body: unknown }[] = [];
  const fetchImpl: typeof fetch = (input, init) => {
    calls.push({
      path: typeof input === 'string' ? input : '',
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    return Promise.resolve(
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
      }),
    );
  };
  return { fetchImpl, calls };
}

describe('cliLoginReader', () => {
  it('reads a login by its code', async () => {
    const { fetchImpl, calls } = answering(200, { ...LOGIN, extra: 1 });
    expect(await cliLoginReader(fetchImpl)('wdjb-mjht')).toEqual({
      status: 'ok',
      login: LOGIN,
    });
    expect(calls).toEqual([
      { path: '/api/auth/cli', body: { code: 'wdjb-mjht' } },
    ]);
  });

  it.each([
    [410, { error: 'gone' }, { status: 'invalid' }],
    [503, {}, { status: 'failed', message: DATABASE_UNREACHABLE }],
    [500, {}, { status: 'failed', message: SERVER_UNREACHABLE }],
    [
      200,
      { machine: 'laptop' },
      { status: 'failed', message: SERVER_UNREACHABLE },
    ],
  ])('answers %i as %j', async (status, body, expected) => {
    const { fetchImpl } = answering(status, body);
    expect(await cliLoginReader(fetchImpl)('code')).toEqual(expected);
  });

  it('reports a network failure', async () => {
    const read = cliLoginReader(() => Promise.reject(new Error('offline')));
    expect(await read('code')).toEqual({
      status: 'failed',
      message: SERVER_UNREACHABLE,
    });
  });
});

describe('cliLoginDecider', () => {
  it.each(['approve', 'cancel'] as const)('sends %s', async (decision) => {
    const { fetchImpl, calls } = answering(204);
    expect(await cliLoginDecider(fetchImpl)('CODE', decision)).toEqual({
      status: 'done',
    });
    expect(calls).toEqual([
      { path: `/api/auth/cli/${decision}`, body: { code: 'CODE' } },
    ]);
  });

  it('answers a code no longer valid as invalid', async () => {
    const { fetchImpl } = answering(410, { error: 'gone' });
    expect(await cliLoginDecider(fetchImpl)('CODE', 'approve')).toEqual({
      status: 'invalid',
    });
  });
});
