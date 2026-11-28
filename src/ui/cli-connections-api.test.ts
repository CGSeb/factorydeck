import { describe, expect, it } from 'vitest';
import { DATABASE_UNREACHABLE, SERVER_UNREACHABLE } from './auth-api.ts';
import {
  cliConnectionDisconnecter,
  cliConnectionsLoader,
} from './cli-connections-api.ts';

const LAPTOP = {
  id: 3,
  machine: 'laptop',
  createdAt: '2026-03-01T09:00:00.000Z',
  lastUsedAt: '2026-03-12T09:00:00.000Z',
};

function answering(status: number, body?: unknown) {
  const calls: { path: string; method: string }[] = [];
  const fetchImpl: typeof fetch = (input, init) => {
    calls.push({
      path: typeof input === 'string' ? input : '',
      method: init?.method ?? 'GET',
    });
    return Promise.resolve(
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
      }),
    );
  };
  return { fetchImpl, calls };
}

describe('cliConnectionsLoader', () => {
  it('reads the connections of the account', async () => {
    const body = { status: 'ok', refreshSeconds: 10, connections: [LAPTOP] };
    const { fetchImpl, calls } = answering(200, body);
    expect(await cliConnectionsLoader(fetchImpl)()).toEqual(body);
    expect(calls).toEqual([
      { path: '/api/account/cli-connections', method: 'GET' },
    ]);
  });

  it('reads an unreachable database', async () => {
    const { fetchImpl } = answering(503, {
      status: 'unreachable',
      refreshSeconds: 10,
    });
    expect(await cliConnectionsLoader(fetchImpl)()).toEqual({
      status: 'unreachable',
      refreshSeconds: 10,
    });
  });

  it.each([
    ['a 401', 401, { error: 'Not signed in' }],
    ['a 500', 500, undefined],
    [
      'a wrong row',
      200,
      { status: 'ok', refreshSeconds: 10, connections: [{ id: '3' }] },
    ],
    ['no refresh', 200, { status: 'ok', connections: [] }],
  ])('answers nothing for %s', async (_name, status, body) => {
    const { fetchImpl } = answering(status, body);
    expect(await cliConnectionsLoader(fetchImpl)()).toBeUndefined();
  });

  it('answers nothing on a network error', async () => {
    const loader = cliConnectionsLoader(() =>
      Promise.reject(new Error('down')),
    );
    expect(await loader()).toBeUndefined();
  });
});

describe('cliConnectionDisconnecter', () => {
  it('deletes the connection by its id', async () => {
    const { fetchImpl, calls } = answering(204);
    expect(await cliConnectionDisconnecter(fetchImpl)(3)).toEqual({
      status: 'disconnected',
    });
    expect(calls).toEqual([
      { path: '/api/account/cli-connections/3', method: 'DELETE' },
    ]);
  });

  it('counts a connection already gone as disconnected', async () => {
    const { fetchImpl } = answering(404, { error: 'Connection not found' });
    expect(await cliConnectionDisconnecter(fetchImpl)(3)).toEqual({
      status: 'disconnected',
    });
  });

  it.each([
    [503, DATABASE_UNREACHABLE],
    [500, SERVER_UNREACHABLE],
    [401, SERVER_UNREACHABLE],
  ])('fails on a %i', async (status, message) => {
    const { fetchImpl } = answering(status, { error: 'x' });
    expect(await cliConnectionDisconnecter(fetchImpl)(3)).toEqual({
      status: 'failed',
      message,
    });
  });

  it('fails on a network error', async () => {
    const disconnect = cliConnectionDisconnecter(() =>
      Promise.reject(new Error('down')),
    );
    expect(await disconnect(3)).toEqual({
      status: 'failed',
      message: SERVER_UNREACHABLE,
    });
  });
});
