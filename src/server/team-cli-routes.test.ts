import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type AuthHarness,
  DAY_MS,
  START,
  authHarness,
  get,
  signedIn,
} from '../test/auth-app.ts';
import { bearer, cliClient } from '../test/cli-client.ts';

let h: AuthHarness;
let ada: number;
let dev: number;
let manager: string;
let devCookie: string;
const cli = cliClient(() => h);

beforeEach(async () => {
  h = await authHarness();
  ada = await h.addAccount('ada@example.test', {
    role: 'manager',
    name: 'Ada',
  });
  dev = await h.addAccount('dev@example.test', { name: 'Dev' });
  manager = await signedIn(h.app(), 'ada@example.test');
  devCookie = await signedIn(h.app(), 'dev@example.test');
});

afterEach(async () => {
  await h.close();
});

function remove(path: string, cookie: string): Promise<Response> {
  return Promise.resolve(
    h.app().request(path, { method: 'DELETE', headers: { cookie } }),
  );
}

function setActive(id: number, active: boolean): Promise<Response> {
  return Promise.resolve(
    h.app().request(`/api/team/accounts/${id}`, {
      method: 'PATCH',
      headers: { cookie: manager, 'content-type': 'application/json' },
      body: JSON.stringify({ active }),
    }),
  );
}

async function counts(): Promise<Record<string, number>> {
  const body = (await (
    await get(h.app(), '/api/team/accounts', manager)
  ).json()) as { accounts: { name: string; cliConnections: number }[] };
  return Object.fromEntries(
    body.accounts.map(({ name, cliConnections }) => [name, cliConnections]),
  );
}

interface Listed {
  id: number;
  machine: string;
  createdAt: string;
  lastUsedAt: string;
}

async function listed(id: number): Promise<Listed[]> {
  const response = await get(
    h.app(),
    `/api/team/accounts/${id}/cli-connections`,
    manager,
  );
  expect(response.status).toBe(200);
  const body = (await response.json()) as { connections: Listed[] };
  return body.connections;
}

describe('the CLI column of GET /api/team/accounts', () => {
  it('counts the active connections of each account, leaving out expired ones', async () => {
    await cli.connect(devCookie, 'old-laptop');
    cli.later(20 * DAY_MS);
    await cli.connect(devCookie, 'laptop');
    await cli.connect(devCookie, 'desktop');
    await cli.connect(manager, 'studio');
    expect(await counts()).toEqual({ Ada: 1, Dev: 3 });

    cli.later(10 * DAY_MS);

    expect(await counts()).toEqual({ Ada: 1, Dev: 2 });
  });

  it('answers 0 for an account without connections', async () => {
    expect(await counts()).toEqual({ Ada: 0, Dev: 0 });
  });
});

describe('GET /api/team/accounts/<id>/cli-connections', () => {
  it('lists the connections of any account, the most recently used first', async () => {
    await cli.connect(devCookie, 'laptop');
    cli.later(DAY_MS);
    await cli.connect(devCookie, 'desktop');
    const laptopConnectedAt = START.toISOString();

    const connections = await listed(dev);

    expect(connections.map(({ machine }) => machine)).toEqual([
      'desktop',
      'laptop',
    ]);
    expect(connections[1]).toMatchObject({
      machine: 'laptop',
      createdAt: laptopConnectedAt,
      lastUsedAt: laptopConnectedAt,
    });
    expect(await listed(ada)).toEqual([]);
  });

  it('leaves out an expired connection', async () => {
    await cli.connect(devCookie, 'laptop');
    cli.later(30 * DAY_MS);
    manager = await signedIn(h.app(), 'ada@example.test');
    expect(await listed(dev)).toEqual([]);
  });

  it.each(['abc', '007', '0', '999'])(
    'answers 404 for the account %s',
    async (id) => {
      const response = await get(
        h.app(),
        `/api/team/accounts/${id}/cli-connections`,
        manager,
      );
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Not found' });
    },
  );

  it('answers 503 while the database is unreachable', async () => {
    const response = await get(
      h.app(false),
      `/api/team/accounts/${dev}/cli-connections`,
      manager,
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ status: 'unreachable' });
  });
});

describe('DELETE /api/team/accounts/<id>/cli-connections/<connection>', () => {
  it("lets a manager disconnect a dev's machine, whose token is refused at once", async () => {
    const token = await cli.connect(devCookie, 'laptop');
    const kept = await cli.connect(devCookie, 'desktop');
    const laptop = (await listed(dev)).find(
      ({ machine }) => machine === 'laptop',
    );

    const response = await remove(
      `/api/team/accounts/${dev}/cli-connections/${laptop?.id}`,
      manager,
    );

    expect(response.status).toBe(204);
    expect((await listed(dev)).map(({ machine }) => machine)).toEqual([
      'desktop',
    ]);
    expect((await cli.get('/api/cli/me', bearer(token))).status).toBe(401);
    expect((await cli.get('/api/cli/me', bearer(kept))).status).toBe(200);
    expect(await counts()).toEqual({ Ada: 0, Dev: 1 });
  });

  it("disconnects the manager's own machine", async () => {
    const token = await cli.connect(manager, 'studio');
    const [studio] = await listed(ada);
    const response = await remove(
      `/api/team/accounts/${ada}/cli-connections/${studio?.id}`,
      manager,
    );
    expect(response.status).toBe(204);
    expect((await cli.get('/api/cli/me', bearer(token))).status).toBe(401);
  });

  it('answers 404 for a connection of another account, an unknown or an expired one', async () => {
    await cli.connect(manager, 'studio');
    const [studio] = await listed(ada);
    await cli.connect(devCookie, 'laptop');
    const [laptop] = await listed(dev);
    cli.later(30 * DAY_MS);
    manager = await signedIn(h.app(), 'ada@example.test');
    for (const path of [
      `/api/team/accounts/${dev}/cli-connections/${studio?.id}`,
      `/api/team/accounts/${dev}/cli-connections/999`,
      `/api/team/accounts/${dev}/cli-connections/abc`,
      `/api/team/accounts/${dev}/cli-connections/${laptop?.id}`,
    ]) {
      const response = await remove(path, manager);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Not found' });
    }
  });
});

describe('the team CLI routes for a dev', () => {
  it('answer 403, listing and deleting nothing', async () => {
    await cli.connect(manager, 'studio');
    const [studio] = await listed(ada);
    const list = await get(
      h.app(),
      `/api/team/accounts/${ada}/cli-connections`,
      devCookie,
    );
    const removed = await remove(
      `/api/team/accounts/${ada}/cli-connections/${studio?.id}`,
      devCookie,
    );
    for (const response of [list, removed]) {
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: 'Managers only' });
    }
    expect(await listed(ada)).toHaveLength(1);
  });
});

describe('deactivating an account', () => {
  it('deletes its connections, so the column and the list show none', async () => {
    const token = await cli.connect(devCookie, 'laptop');
    await cli.connect(devCookie, 'desktop');

    const response = await setActive(dev, false);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ cliConnections: 0 });
    expect(await listed(dev)).toEqual([]);
    expect(await counts()).toEqual({ Ada: 0, Dev: 0 });
    expect((await cli.get('/api/cli/me', bearer(token))).status).toBe(401);
  });
});
