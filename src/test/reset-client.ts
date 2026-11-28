import { eq } from 'drizzle-orm';
import { expect } from 'vitest';
import { signInSession } from '../db/schema.ts';
import { type AuthHarness, signedIn } from './auth-app.ts';

export const GONE = {
  error: 'This link no longer works. Ask a manager for a new one.',
};
export const NEW_PASSWORD = 'a brand new passphrase';

export interface ResetClient {
  post: (
    path: string,
    body: unknown,
    cookie?: string,
    up?: boolean,
  ) => Promise<Response>;
  team: () => Promise<{ ada: number; bob: number; cookie: string }>;
  createLink: (id: number | string, cookie: string) => Promise<Response>;
  linkFor: (id: number, cookie: string) => Promise<string>;
  save: (
    token: unknown,
    password?: unknown,
    cookie?: string,
  ) => Promise<Response>;
  sessionsOf: (id: number) => Promise<number>;
}

export function resetClient(harness: () => AuthHarness): ResetClient {
  const client: ResetClient = {
    post: (path, body, cookie, up = true) =>
      Promise.resolve(
        harness()
          .app(up)
          .request(path, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              ...(cookie === undefined ? {} : { cookie }),
            },
            ...(body === undefined
              ? {}
              : {
                  body: typeof body === 'string' ? body : JSON.stringify(body),
                }),
          }),
      ),
    team: async () => {
      const h = harness();
      const ada = await h.addAccount('ada@example.test', {
        role: 'manager',
        name: 'Ada',
      });
      const bob = await h.addAccount('bob@example.test', { name: 'Bob' });
      const cookie = await signedIn(h.app(), 'ada@example.test');
      return { ada, bob, cookie };
    },
    createLink: (id, cookie) =>
      client.post(`/api/team/accounts/${id}/reset-link`, undefined, cookie),
    linkFor: async (id, cookie) => {
      const response = await client.createLink(id, cookie);
      expect(response.status).toBe(201);
      const body: unknown = await response.json();
      return typeof body === 'object' &&
        body !== null &&
        'token' in body &&
        typeof body.token === 'string'
        ? body.token
        : '';
    },
    save: (token, password = NEW_PASSWORD, cookie) =>
      client.post('/api/auth/reset/save', { token, password }, cookie),
    sessionsOf: async (id) => {
      const rows = await harness()
        .db.select({ id: signInSession.id })
        .from(signInSession)
        .where(eq(signInSession.accountId, id));
      return rows.length;
    },
  };
  return client;
}
