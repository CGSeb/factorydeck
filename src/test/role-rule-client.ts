import { type AuthHarness, get, signedIn } from './auth-app.ts';

export interface StoredRule {
  name: string;
  description: string | null;
  agentType: string | null;
}

export interface RoleRuleClient {
  path: (id: number | string) => string;
  manager: () => Promise<string>;
  added: (cookie: string, remote?: string) => Promise<number>;
  stored: (cookie: string, id: number) => Promise<unknown>;
  put: (
    id: number | string,
    body: unknown,
    cookie: string,
  ) => Promise<Response>;
  refusal: (id: number, body: unknown, cookie: string) => Promise<unknown>;
}

export function roleRule(
  name: string,
  description: string | null = '^Go ',
): StoredRule {
  return { name, description, agentType: null };
}

function field(body: unknown, name: string): unknown {
  if (typeof body !== 'object' || body === null) {
    throw new Error(`No ${name} in the answer`);
  }
  return Object.entries(body).find(([key]) => key === name)?.[1];
}

export function roleRuleClient(harness: () => AuthHarness): RoleRuleClient {
  const send = (
    method: 'POST' | 'PUT',
    path: string,
    body: unknown,
    cookie: string,
  ): Promise<Response> =>
    Promise.resolve(
      harness()
        .app()
        .request(path, {
          method,
          headers: { 'content-type': 'application/json', cookie },
          body: typeof body === 'string' ? body : JSON.stringify(body),
        }),
    );
  const path = (id: number | string): string =>
    `/api/admin/projects/${String(id)}/rules/role`;
  return {
    path,
    manager: async () => {
      await harness().addAccount('ada@example.test', {
        role: 'manager',
        name: 'Ada',
      });
      return signedIn(harness().app(), 'ada@example.test');
    },
    added: async (cookie, remote = 'https://github.com/owner/shop') => {
      const response = await send(
        'POST',
        '/api/admin/projects',
        { remote },
        cookie,
      );
      const body: unknown = await response.json();
      const id = field(body, 'id');
      if (typeof id !== 'number') throw new Error('No project added');
      return id;
    },
    stored: async (cookie, id) => {
      const response = await get(harness().app(), path(id), cookie);
      const body: unknown = await response.json();
      return field(body, 'rules');
    },
    put: (id, body, cookie) => send('PUT', path(id), body, cookie),
    refusal: async (id, body, cookie) => {
      const response = await send('PUT', path(id), body, cookie);
      const answer: unknown = await response.json();
      return answer;
    },
  };
}
