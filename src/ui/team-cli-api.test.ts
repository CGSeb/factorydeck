import { describe, expect, it, vi } from 'vitest';
import { teamCliActions } from './team-cli-api.ts';

const connection = {
  id: 7,
  machine: 'laptop',
  createdAt: '2026-03-01T10:00:00.000Z',
  lastUsedAt: '2026-03-12T10:00:00.000Z',
};

function answering(status: number, body?: unknown): typeof fetch {
  return vi.fn<typeof fetch>(() =>
    Promise.resolve(
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
      }),
    ),
  );
}

describe('teamCliActions().load', () => {
  it("reads an account's connections", async () => {
    const fetchImpl = answering(200, {
      status: 'ok',
      refreshSeconds: 10,
      connections: [connection],
    });
    await expect(teamCliActions(fetchImpl).load(4)).resolves.toEqual({
      status: 'ok',
      connections: [connection],
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/team/accounts/4/cli-connections',
    );
  });

  it.each([
    [403, undefined, { status: 'refused' }],
    [
      503,
      { status: 'unreachable', refreshSeconds: 10 },
      {
        status: 'failed',
        message: 'Database unreachable. Start it with pnpm db:up.',
      },
    ],
    [
      404,
      { error: 'Not found' },
      { status: 'failed', message: 'Could not reach the server' },
    ],
    [
      200,
      { status: 'ok' },
      { status: 'failed', message: 'Could not reach the server' },
    ],
  ])('answers %i as a view', async (status, body, view) => {
    await expect(
      teamCliActions(answering(status, body)).load(4),
    ).resolves.toEqual(view);
  });

  it('answers a network error as a failure', async () => {
    const fetchImpl = () => Promise.reject(new Error('offline'));
    await expect(teamCliActions(fetchImpl).load(4)).resolves.toEqual({
      status: 'failed',
      message: 'Could not reach the server',
    });
  });
});

describe('teamCliActions().disconnect', () => {
  it('deletes one connection of the account', async () => {
    const fetchImpl = answering(204);
    await expect(teamCliActions(fetchImpl).disconnect(4, 7)).resolves.toEqual({
      status: 'done',
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/team/accounts/4/cli-connections/7',
      { method: 'DELETE' },
    );
  });

  it.each([
    [404, { status: 'done' }],
    [403, { status: 'refused' }],
    [
      503,
      {
        status: 'failed',
        message: 'Database unreachable. Start it with pnpm db:up.',
      },
    ],
    [500, { status: 'failed', message: 'Could not reach the server' }],
  ])('answers %i as an outcome', async (status, outcome) => {
    await expect(
      teamCliActions(answering(status)).disconnect(4, 7),
    ).resolves.toEqual(outcome);
  });
});
