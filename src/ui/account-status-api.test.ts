import { describe, expect, it } from 'vitest';
import { activeChanger } from './account-status-api.ts';
import { someTeam } from './team-fixtures.ts';

const row = { ...someTeam[1], active: false };

function answering(response: Response | Error): typeof fetch {
  return () =>
    response instanceof Error
      ? Promise.reject(response)
      : Promise.resolve(response);
}

describe('accountChanger', () => {
  it('sends a PATCH with the change and gives the new row', async () => {
    const sent: { url: string; init: RequestInit | undefined }[] = [];
    const change = await activeChanger((input, init) => {
      sent.push({ url: typeof input === 'string' ? input : '', init });
      return Promise.resolve(Response.json(row));
    })(4, false);
    expect(sent).toEqual([
      {
        url: '/api/team/accounts/4',
        init: {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: '{"active":false}',
        },
      },
    ]);
    expect(change).toEqual({ status: 'changed', account: row });
  });

  it('gives the refusal for a 403', async () => {
    const answer = Response.json({ error: 'Managers only' }, { status: 403 });
    await expect(activeChanger(answering(answer))(4, false)).resolves.toEqual({
      status: 'refused',
    });
  });

  it.each([
    [
      'the message of a 409',
      Response.json(
        { error: 'You cannot deactivate yourself' },
        { status: 409 },
      ),
      'You cannot deactivate yourself',
    ],
    [
      'the server message on a 404',
      Response.json({ error: 'Not found' }, { status: 404 }),
      'Could not reach the server',
    ],
    [
      'the database message on a 503',
      Response.json(
        { status: 'unreachable', refreshSeconds: 10 },
        { status: 503 },
      ),
      'Database unreachable. Start it with pnpm db:up.',
    ],
    [
      'the server message on a 500 without a message',
      new Response('oops', { status: 500 }),
      'Could not reach the server',
    ],
    [
      'the server message on a 200 that is not a row',
      Response.json({ id: 4 }),
      'Could not reach the server',
    ],
    [
      'the server message on a network error',
      new Error('offline'),
      'Could not reach the server',
    ],
  ])('gives %s', async (_, answer, message) => {
    await expect(activeChanger(answering(answer))(4, true)).resolves.toEqual({
      status: 'failed',
      message,
    });
  });
});
