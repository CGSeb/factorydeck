import { describe, expect, it } from 'vitest';
import { DATABASE_UNREACHABLE, SERVER_UNREACHABLE } from './auth-api.ts';
import {
  createdInvitation,
  pendingInvitations,
} from './invitation-fixtures.ts';
import {
  invitationAccepter,
  invitationActions,
  invitationReader,
  invitationsLoader,
  inviteLink,
} from './invitations-api.ts';
import { aloneManager, teamLoaderOf, teamResponse } from './team-fixtures.ts';
import { withInvitations } from './team-api.ts';

function answering(
  response: Response | Error,
  calls: { url: string; init: RequestInit | undefined }[] = [],
): typeof fetch {
  return (input, init) => {
    calls.push({ url: typeof input === 'string' ? input : '', init });
    return response instanceof Error
      ? Promise.reject(response)
      : Promise.resolve(response);
  };
}

const created = createdInvitation();

describe('invitationActions', () => {
  it('posts the email and role, and gives the created invitation', async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const outcome = await invitationActions(
      answering(Response.json(created, { status: 201 }), calls),
    ).invite({ email: 'hal@example.test', role: 'dev' });
    expect(outcome).toEqual({ status: 'created', invitation: created });
    expect(calls[0]?.url).toBe('/api/team/invitations');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(calls[0]?.init?.body).toBe(
      JSON.stringify({ email: 'hal@example.test', role: 'dev' }),
    );
  });

  it('gives a 400 under its field and a 409 under the email', async () => {
    const actions = (response: Response) =>
      invitationActions(answering(response)).invite({
        email: 'x',
        role: 'dev',
      });
    await expect(
      actions(
        Response.json(
          { error: 'Role must be manager or dev', field: 'role' },
          { status: 400 },
        ),
      ),
    ).resolves.toEqual({
      status: 'invalid',
      field: 'role',
      message: 'Role must be manager or dev',
    });
    await expect(
      actions(
        Response.json(
          { error: 'This email already has an account' },
          { status: 409 },
        ),
      ),
    ).resolves.toEqual({
      status: 'invalid',
      field: 'email',
      message: 'This email already has an account',
    });
  });

  it.each([
    [
      'a 503',
      Response.json({ status: 'unreachable' }, { status: 503 }),
      DATABASE_UNREACHABLE,
    ],
    ['a network error', new Error('offline'), SERVER_UNREACHABLE],
    ['a 500', new Response('oops', { status: 500 }), SERVER_UNREACHABLE],
  ])('fails with a message on %s', async (_, response, message) => {
    const actions = invitationActions(answering(response));
    await expect(
      actions.invite({ email: 'hal@example.test', role: 'dev' }),
    ).resolves.toEqual({ status: 'failed', message });
    await expect(actions.newLink(1)).resolves.toEqual({
      status: 'failed',
      message,
    });
    await expect(actions.revoke(1)).resolves.toEqual({
      status: 'failed',
      message,
    });
  });

  it('gives the 404 message of a new link on a gone invitation', async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    await expect(
      invitationActions(
        answering(
          Response.json({ error: 'Invitation not found' }, { status: 404 }),
          calls,
        ),
      ).newLink(7),
    ).resolves.toEqual({ status: 'failed', message: 'Invitation not found' });
    expect(calls[0]?.url).toBe('/api/team/invitations/7/new-link');
  });

  it('revokes with a DELETE answered 204', async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    await expect(
      invitationActions(
        answering(new Response(null, { status: 204 }), calls),
      ).revoke(7),
    ).resolves.toEqual({ status: 'revoked' });
    expect(calls[0]).toEqual({
      url: '/api/team/invitations/7',
      init: { method: 'DELETE' },
    });
  });
});

describe('invitationsLoader and withInvitations', () => {
  const list = {
    status: 'ok',
    refreshSeconds: 10,
    invitations: pendingInvitations,
  };

  it('gives the list, nothing for a bad answer, and the unreachable body', async () => {
    await expect(
      invitationsLoader(answering(Response.json(list)))(),
    ).resolves.toEqual(list);
    await expect(
      invitationsLoader(answering(Response.json({ status: 'ok' })))(),
    ).resolves.toBeUndefined();
    await expect(
      invitationsLoader(
        answering(
          Response.json(
            { status: 'unreachable', refreshSeconds: 10 },
            { status: 503 },
          ),
        ),
      )(),
    ).resolves.toEqual({ status: 'unreachable', refreshSeconds: 10 });
  });

  it('joins the invitations to the accounts in one view', async () => {
    const team = teamResponse(aloneManager);
    const load = withInvitations(teamLoaderOf(team), () =>
      Promise.resolve({
        status: 'ok',
        refreshSeconds: 10,
        invitations: pendingInvitations,
      }),
    );
    await expect(load()).resolves.toEqual({
      ...team,
      invitations: pendingInvitations,
    });
    await expect(
      withInvitations(teamLoaderOf(team), () =>
        Promise.resolve({ status: 'unreachable', refreshSeconds: 10 }),
      )(),
    ).resolves.toEqual({ status: 'unreachable', refreshSeconds: 10 });
    await expect(
      withInvitations(teamLoaderOf(team), () => Promise.resolve(undefined))(),
    ).resolves.toBeUndefined();
    const refused = { status: 'refused', refreshSeconds: 10 } as const;
    await expect(
      withInvitations(teamLoaderOf(refused), () =>
        Promise.resolve(undefined),
      )(),
    ).resolves.toEqual(refused);
  });
});

describe('invitationReader', () => {
  it.each([
    [
      Response.json({ email: 'hal@example.test', role: 'dev' }),
      { status: 'pending', email: 'hal@example.test', role: 'dev' },
    ],
    [Response.json({ error: 'gone' }, { status: 410 }), { status: 'dead' }],
    [
      Response.json({ status: 'unreachable' }, { status: 503 }),
      { status: 'unreachable', message: DATABASE_UNREACHABLE },
    ],
    [
      new Error('offline'),
      { status: 'unreachable', message: SERVER_UNREACHABLE },
    ],
    [
      new Response('oops', { status: 502 }),
      { status: 'unreachable', message: SERVER_UNREACHABLE },
    ],
  ])('reads %o as %o', async (response, read) => {
    await expect(invitationReader(answering(response))('t')).resolves.toEqual(
      read,
    );
  });
});

describe('invitationAccepter', () => {
  const input = { token: 't', name: 'Hal', password: 'a long passphrase' };

  it.each([
    [
      Response.json(
        { id: 9, email: 'hal@example.test', name: 'Hal', role: 'dev' },
        { status: 201 },
      ),
      {
        status: 'created',
        account: { id: 9, email: 'hal@example.test', name: 'Hal', role: 'dev' },
      },
    ],
    [Response.json({ error: 'gone' }, { status: 410 }), { status: 'dead' }],
    [
      Response.json(
        { error: 'Name is required', field: 'name' },
        { status: 400 },
      ),
      { status: 'invalid', field: 'name', message: 'Name is required' },
    ],
    [
      Response.json({ status: 'unreachable' }, { status: 503 }),
      { status: 'failed', message: DATABASE_UNREACHABLE },
    ],
    [new Error('offline'), { status: 'failed', message: SERVER_UNREACHABLE }],
  ])('reads %o as %o', async (response, outcome) => {
    await expect(
      invitationAccepter(answering(response))(input),
    ).resolves.toEqual(outcome);
  });
});

describe('inviteLink', () => {
  it('puts the token under /invite/ of the origin', () => {
    expect(inviteLink('https://deck.example.test', 'abc')).toBe(
      'https://deck.example.test/invite/abc',
    );
  });
});
