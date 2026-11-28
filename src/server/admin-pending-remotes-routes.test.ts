import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { project, rootRemote, session } from '../db/schema.ts';
import {
  type AuthHarness,
  START,
  authHarness,
  get,
  signedIn,
} from '../test/auth-app.ts';

let h: AuthHarness;

beforeEach(async () => {
  h = await authHarness();
});

afterEach(async () => {
  await h.close();
});

function post(path: string, body: unknown, cookie: string): Promise<Response> {
  return Promise.resolve(
    h.app().request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(body),
    }),
  );
}

async function manager(): Promise<string> {
  await h.addAccount('ada@example.test', { role: 'manager', name: 'Ada' });
  return signedIn(h.app(), 'ada@example.test');
}

describe('GET /api/admin/projects: remotes not added', () => {
  it('lists a remote with sessions and no project until it is added, and the sessions with no remote', async () => {
    const cookie = await manager();
    const stray = 'github.com/owner/stray';
    await h.db
      .insert(rootRemote)
      .values({ root: '/work/stray', remote: stray });
    await h.db.insert(session).values([
      { id: 's1', project: '/work/stray', firstAt: START, lastAt: START },
      { id: 's2', project: 'unassigned', firstAt: START, lastAt: START },
    ]);
    await h.db.delete(project);

    const before = await get(h.app(), '/api/admin/projects', cookie);

    expect(await before.json()).toMatchObject({
      pendingRemotes: [
        {
          remote: stray,
          sessions: 1,
          firstAt: START.toISOString(),
          lastAt: START.toISOString(),
        },
      ],
      noRemote: { sessions: 1, folders: 0 },
    });
    const added = await post(
      '/api/admin/projects',
      { remote: `https://${stray}` },
      cookie,
    );
    expect(added.status).toBe(201);
    expect(await added.json()).toMatchObject({ name: 'stray', remote: stray });

    const after = await get(h.app(), '/api/admin/projects', cookie);

    expect(await after.json()).toMatchObject({
      pendingRemotes: [],
      noRemote: { sessions: 1, folders: 0 },
    });
  });
});
