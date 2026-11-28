import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cliConnection } from '../db/schema.ts';
import {
  type AuthHarness,
  DAY_MS,
  START,
  authHarness,
  signedIn,
} from '../test/auth-app.ts';
import { bearer, cliClient } from '../test/cli-client.ts';

let h: AuthHarness;
let ada: string;
let grace: string;
const { get, connect, later } = cliClient(() => h);

const LIST = '/api/account/cli-connections';
const MINUTE_MS = 60_000;
const NOT_FOUND = { error: 'Connection not found' };
const NOT_SIGNED_IN = { error: 'Not signed in' };

beforeEach(async () => {
  h = await authHarness();
  await h.addAccount('ada@example.test', { name: 'Ada', role: 'manager' });
  await h.addAccount('grace@example.test', { name: 'Grace' });
  ada = await signedIn(h.app(), 'ada@example.test');
  grace = await signedIn(h.app(), 'grace@example.test');
});

afterEach(async () => {
  await h.close();
});

function remove(
  id: number | string,
  headers: Record<string, string>,
  up = true,
): Promise<Response> {
  return Promise.resolve(
    h.app(up).request(`${LIST}/${String(id)}`, { method: 'DELETE', headers }),
  );
}

interface Listed {
  id: number;
  machine: string;
  createdAt: string;
  lastUsedAt: string;
}

async function listed(cookie: string): Promise<Listed[]> {
  const response = await get(LIST, { cookie });
  expect(response.status).toBe(200);
  const body = (await response.json()) as { connections: Listed[] };
  return body.connections;
}

async function idOf(cookie: string, machine: string): Promise<number> {
  const found = (await listed(cookie)).find((row) => row.machine === machine);
  return found?.id ?? 0;
}

describe('GET /api/account/cli-connections', () => {
  it('lists the account own connections, most recently used first', async () => {
    const laptop = await connect(ada, 'laptop');
    later(2 * MINUTE_MS);
    await connect(ada, 'desktop');
    await connect(grace, 'grace-laptop');
    later(2 * MINUTE_MS);
    expect((await get('/api/cli/me', bearer(laptop))).status).toBe(200);
    const response = await get(LIST, { cookie: ada });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      status: string;
      refreshSeconds: number;
      connections: Listed[];
    };
    expect(body.status).toBe('ok');
    expect(body.refreshSeconds).toBe(10);
    expect(body.connections.map(({ id: _id, ...row }) => row)).toEqual([
      {
        machine: 'laptop',
        createdAt: START.toISOString(),
        lastUsedAt: new Date(START.getTime() + 4 * MINUTE_MS).toISOString(),
      },
      {
        machine: 'desktop',
        createdAt: new Date(START.getTime() + 2 * MINUTE_MS).toISOString(),
        lastUsedAt: new Date(START.getTime() + 2 * MINUTE_MS).toISOString(),
      },
    ]);
  });

  it('answers an empty list for an account without connections', async () => {
    await connect(grace, 'grace-laptop');
    expect(await listed(ada)).toEqual([]);
  });

  it('leaves out an expired connection', async () => {
    await connect(ada, 'old-laptop');
    later(29 * DAY_MS);
    await connect(ada, 'new-laptop');
    expect((await listed(ada)).map(({ machine }) => machine)).toEqual([
      'new-laptop',
      'old-laptop',
    ]);
    later(DAY_MS);
    expect((await listed(ada)).map(({ machine }) => machine)).toEqual([
      'new-laptop',
    ]);
  });

  it('refuses a CLI token and needs the session cookie', async () => {
    const token = await connect(ada, 'laptop');
    const withToken = await get(LIST, bearer(token));
    expect(withToken.status).toBe(401);
    expect(await withToken.json()).toEqual(NOT_SIGNED_IN);
    expect((await get(LIST)).status).toBe(401);
  });

  it('answers 503 while the database is unreachable', async () => {
    const response = await Promise.resolve(
      h.app(false).request(LIST, { headers: { cookie: ada } }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'unreachable',
      refreshSeconds: 10,
    });
  });
});

describe('DELETE /api/account/cli-connections/<id>', () => {
  it('disconnects the machine, whose token is refused from the next request', async () => {
    const laptop = await connect(ada, 'laptop');
    const desktop = await connect(ada, 'desktop');
    const response = await remove(await idOf(ada, 'laptop'), { cookie: ada });
    expect(response.status).toBe(204);
    const refused = await get('/api/cli/me', bearer(laptop));
    expect(refused.status).toBe(401);
    expect(await refused.json()).toEqual({ error: 'Run factorydeck login' });
    expect((await get('/api/cli/me', bearer(desktop))).status).toBe(200);
    expect((await listed(ada)).map(({ machine }) => machine)).toEqual([
      'desktop',
    ]);
  });

  it("answers 404 for another account's connection and keeps it", async () => {
    const token = await connect(grace, 'grace-laptop');
    const id = await idOf(grace, 'grace-laptop');
    const response = await remove(id, { cookie: ada });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual(NOT_FOUND);
    expect((await get('/api/cli/me', bearer(token))).status).toBe(200);
    expect(await h.db.select().from(cliConnection)).toHaveLength(1);
  });

  it.each(['999', 'abc', '0', '1.5', '-1', '99999999999999999'])(
    'answers 404 for the id %s',
    async (id) => {
      await connect(ada, 'laptop');
      const response = await remove(id, { cookie: ada });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual(NOT_FOUND);
    },
  );

  it('answers 404 the second time', async () => {
    await connect(ada, 'laptop');
    const id = await idOf(ada, 'laptop');
    expect((await remove(id, { cookie: ada })).status).toBe(204);
    expect((await remove(id, { cookie: ada })).status).toBe(404);
  });

  it('refuses a CLI token, even its own connection', async () => {
    const token = await connect(ada, 'laptop');
    const id = await idOf(ada, 'laptop');
    const response = await remove(id, bearer(token));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(NOT_SIGNED_IN);
    expect((await get('/api/cli/me', bearer(token))).status).toBe(200);
  });

  it('answers 503 while the database is unreachable', async () => {
    await connect(ada, 'laptop');
    const id = await idOf(ada, 'laptop');
    const response = await remove(id, { cookie: ada }, false);
    expect(response.status).toBe(503);
    expect(await listed(ada)).toHaveLength(1);
  });
});
