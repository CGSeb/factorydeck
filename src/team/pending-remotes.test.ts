import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import {
  project,
  removedSession,
  rootRemote,
  session,
  subAgent,
} from '../db/schema.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { byLastSession, remotesNotAdded } from './pending-remotes.ts';

const SHOP = 'github.com/owner/shop';
const STRAY = 'gitlab.example.test/group/stray';
const LATE = 'github.com/owner/late';
const at = (day: number): Date => new Date(Date.UTC(2026, 2, day, 9));

let db: Database;
let close: () => Promise<void>;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase({ linkRoots: false }));
});

afterEach(async () => {
  await close();
});

function addSession(
  id: string,
  root: string,
  firstAt: Date | null,
  lastAt: Date | null = firstAt,
) {
  return db.insert(session).values({ id, project: root, firstAt, lastAt });
}

describe('remotesNotAdded', () => {
  it('lists each remote with sessions and no project, its counts and times', async () => {
    await db.insert(project).values({
      name: 'Shop',
      slug: 'shop',
      remote: SHOP,
      createdAt: at(1),
    });
    await db.insert(rootRemote).values([
      { root: '/work/shop', remote: SHOP },
      { root: '/work/stray', remote: STRAY },
      { root: '/home/dev/stray', remote: STRAY },
      { root: '/work/late', remote: LATE },
    ]);
    await addSession('s1', '/work/shop', at(2));
    await addSession('s2', '/work/stray', at(3), at(4));
    await addSession('s3', '/home/dev/stray', at(5), at(6));
    await addSession('s4', '/work/late', at(1), at(9));
    await db.insert(subAgent).values({ sessionId: 's2', id: 'a1' });

    expect(await remotesNotAdded(db)).toEqual({
      pendingRemotes: [
        {
          remote: LATE,
          sessions: 1,
          firstAt: at(1).toISOString(),
          lastAt: at(9).toISOString(),
        },
        {
          remote: STRAY,
          sessions: 2,
          firstAt: at(3).toISOString(),
          lastAt: at(6).toISOString(),
        },
      ],
      noRemote: null,
    });
  });

  it('reads every session time that is not null, and null when none is', async () => {
    await db.insert(rootRemote).values([
      { root: '/work/stray', remote: STRAY },
      { root: '/work/blank', remote: LATE },
    ]);
    await addSession('s1', '/work/stray', null, at(4));
    await addSession('s2', '/work/stray', at(7), null);
    await addSession('s3', '/work/blank', null, null);

    expect((await remotesNotAdded(db)).pendingRemotes).toEqual([
      {
        remote: STRAY,
        sessions: 2,
        firstAt: at(4).toISOString(),
        lastAt: at(7).toISOString(),
      },
      { remote: LATE, sessions: 1, firstAt: null, lastAt: null },
    ]);
  });

  it('counts the sessions with no remote and their folders, unassigned left out of the folders', async () => {
    await db.insert(rootRemote).values({ root: '/work/stray', remote: STRAY });
    await addSession('s1', '/work/stray', at(2));
    await addSession('s2', '/work/local', at(3));
    await addSession('s3', '/work/local', at(4));
    await addSession('s4', '/work/other', at(5));
    await addSession('s5', 'unassigned', at(6));

    expect((await remotesNotAdded(db)).noRemote).toEqual({
      sessions: 4,
      folders: 2,
    });
  });

  it('takes the root remote first, else the remote the session was sent with', async () => {
    await db.insert(project).values({
      name: 'Shop',
      slug: 'shop',
      remote: SHOP,
      createdAt: at(1),
    });
    await db.insert(rootRemote).values({ root: '/work/stray', remote: STRAY });
    await db.insert(session).values([
      { id: 'root-wins', project: '/work/stray', remote: SHOP, firstAt: at(2) },
      { id: 'cli', remote: LATE, firstAt: at(3) },
      { id: 'cli-shop', remote: SHOP, firstAt: at(4) },
      { id: 'cli-none', remote: null, firstAt: at(5) },
    ]);

    expect(await remotesNotAdded(db)).toEqual({
      pendingRemotes: [
        {
          remote: LATE,
          sessions: 1,
          firstAt: at(3).toISOString(),
          lastAt: at(3).toISOString(),
        },
        {
          remote: STRAY,
          sessions: 1,
          firstAt: at(2).toISOString(),
          lastAt: at(2).toISOString(),
        },
      ],
      noRemote: { sessions: 1, folders: 0 },
    });
  });

  it('never counts a session listed as removed', async () => {
    await db.insert(rootRemote).values({ root: '/work/stray', remote: STRAY });
    await addSession('old', '/work/stray', at(2));
    await addSession('gone', '/work/local', at(2));
    await addSession('later', '/work/stray', at(8));
    await db.insert(removedSession).values([
      { sessionId: 'old', projectName: 'stray', removedAt: at(5) },
      { sessionId: 'gone', projectName: 'local', removedAt: at(5) },
    ]);

    expect(await remotesNotAdded(db)).toEqual({
      pendingRemotes: [
        {
          remote: STRAY,
          sessions: 1,
          firstAt: at(8).toISOString(),
          lastAt: at(8).toISOString(),
        },
      ],
      noRemote: null,
    });
  });

  it('answers no line when every session has a project', async () => {
    expect(await remotesNotAdded(db)).toEqual({
      pendingRemotes: [],
      noRemote: null,
    });
  });
});

describe('byLastSession', () => {
  const line = (remote: string, lastAt: string | null) => ({
    remote,
    sessions: 1,
    firstAt: null,
    lastAt,
  });

  it('sorts by last session, most recent first, a null last and ties by remote', () => {
    const lines = [
      line('c.test/a/b', null),
      line('b.test/a/b', '2026-03-01T00:00:00.000Z'),
      line('a.test/a/b', null),
      line('d.test/a/b', '2026-03-02T00:00:00.000Z'),
      line('a.test/a/b', '2026-03-01T00:00:00.000Z'),
    ];

    expect(lines.sort(byLastSession)).toEqual([
      line('d.test/a/b', '2026-03-02T00:00:00.000Z'),
      line('a.test/a/b', '2026-03-01T00:00:00.000Z'),
      line('b.test/a/b', '2026-03-01T00:00:00.000Z'),
      line('a.test/a/b', null),
      line('c.test/a/b', null),
    ]);
  });
});
