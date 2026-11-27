import { expect } from 'vitest';
import { type AuthHarness, get, signedIn } from './auth-app.ts';

export const DEAD = {
  error: 'This invitation link no longer works. Ask a manager for a new one.',
};
export const NOT_FOUND = { error: 'Invitation not found' };
export const NEW_PASSWORD = 'another long passphrase';

export interface Created {
  id: number;
  email: string;
  role: string;
  invitedBy: string | null;
  createdAt: string;
  expiresAt: string;
  token: string;
}

function isCreated(body: unknown): body is Created {
  return (
    typeof body === 'object' &&
    body !== null &&
    'id' in body &&
    typeof body.id === 'number' &&
    'token' in body &&
    typeof body.token === 'string'
  );
}

export interface InvitationClient {
  send: (
    method: string,
    path: string,
    body?: unknown,
    cookie?: string,
  ) => Promise<Response>;
  manager: (
    email?: string,
    name?: string,
  ) => Promise<{ id: number; cookie: string }>;
  invite: (cookie: string, email?: string, role?: string) => Promise<Created>;
  read: (token: unknown) => Promise<Response>;
  accept: (
    token: unknown,
    fields?: Record<string, unknown>,
    cookie?: string,
  ) => Promise<Response>;
  pendingList: (cookie: string) => Promise<unknown[]>;
}

export function invitationClient(harness: () => AuthHarness): InvitationClient {
  const send: InvitationClient['send'] = (method, path, body, cookie) => {
    const headers: Record<string, string> = {};
    if (cookie !== undefined) headers['cookie'] = cookie;
    if (body !== undefined) headers['content-type'] = 'application/json';
    return Promise.resolve(
      harness()
        .app()
        .request(path, {
          method,
          headers,
          body: body === undefined ? null : JSON.stringify(body),
        }),
    );
  };
  return {
    send,
    manager: async (email = 'ada@example.test', name = 'Ada') => {
      const h = harness();
      const id = await h.addAccount(email, { role: 'manager', name });
      return { id, cookie: await signedIn(h.app(), email) };
    },
    invite: async (cookie, email = 'dev@example.test', role = 'dev') => {
      const response = await send(
        'POST',
        '/api/team/invitations',
        { email, role },
        cookie,
      );
      expect(response.status).toBe(201);
      const body: unknown = await response.json();
      if (!isCreated(body)) throw new Error('No invitation in the answer');
      return body;
    },
    read: (token) => send('POST', '/api/auth/invitation', { token }),
    accept: (token, fields = { name: 'Dev', password: NEW_PASSWORD }, cookie) =>
      send('POST', '/api/auth/invitation/accept', { token, ...fields }, cookie),
    pendingList: async (cookie) => {
      const response = await get(
        harness().app(),
        '/api/team/invitations',
        cookie,
      );
      expect(response.status).toBe(200);
      const body: unknown = await response.json();
      if (
        typeof body !== 'object' ||
        body === null ||
        !('invitations' in body) ||
        !Array.isArray(body.invitations)
      ) {
        throw new Error('No invitations in the answer');
      }
      const invitations: unknown[] = body.invitations;
      return invitations;
    },
  };
}
