import { describe, expect, it, vi } from 'vitest';
import { roleChanger } from './role-change-api.ts';

const row = {
  id: 4,
  name: 'Bruno',
  email: 'bruno@example.test',
  role: 'manager',
  active: true,
  lastSignInAt: null,
  you: false,
};

function answering(status: number, body?: unknown): typeof fetch {
  return () =>
    Promise.resolve(
      new Response(body === undefined ? 'oops' : JSON.stringify(body), {
        status,
      }),
    );
}

describe('roleChanger', () => {
  it('sends the role as a PATCH of the account', async () => {
    const fetchImpl = vi.fn<typeof fetch>(answering(200, row));
    await roleChanger(fetchImpl)(4, 'manager');
    expect(fetchImpl).toHaveBeenCalledWith('/api/team/accounts/4', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: '{"role":"manager"}',
    });
  });

  it('answers the changed row', async () => {
    expect(await roleChanger(answering(200, row))(4, 'manager')).toEqual({
      status: 'changed',
      account: row,
    });
  });

  it('reads a 403 as the refusal of the page', async () => {
    expect(
      await roleChanger(answering(403, { error: 'Managers only' }))(4, 'dev'),
    ).toEqual({ status: 'refused' });
  });

  it.each([
    [
      409,
      { error: 'You cannot change your own role' },
      'You cannot change your own role',
    ],
    [
      400,
      { error: 'Role must be manager or dev' },
      'Role must be manager or dev',
    ],
    [
      503,
      { status: 'unreachable', refreshSeconds: 10 },
      'Database unreachable. Start it with pnpm db:up.',
    ],
    [404, { error: 'Not found' }, 'Could not reach the server'],
    [500, undefined, 'Could not reach the server'],
    [502, { error: '' }, 'Could not reach the server'],
    [200, { id: 4 }, 'Could not reach the server'],
  ])('answers %i with a message', async (status, body, message) => {
    expect(await roleChanger(answering(status, body))(4, 'dev')).toEqual({
      status: 'failed',
      message,
    });
  });

  it('reads a network error as an unreachable server', async () => {
    expect(
      await roleChanger(() => Promise.reject(new TypeError('offline')))(
        4,
        'dev',
      ),
    ).toEqual({ status: 'failed', message: 'Could not reach the server' });
  });
});
