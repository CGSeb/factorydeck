import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkBatch } from '../cli-ingest/batch-schema.ts';
import { storeBatch } from '../cli-ingest/store-batch.ts';
import type { Database } from '../db/client.ts';
import {
  account,
  apiCall,
  gitHostIssue,
  gitHostProject,
  gitHostRequest,
  ingestFile,
  markedReport,
  project,
  projectRule,
  removedSession,
  rootRemote,
  session,
} from '../db/schema.ts';
import {
  NORMAL_REMOTE,
  mainThread,
  minutes,
  subAgentThread,
} from '../test/cli-batch.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { seedGitHostRows } from '../test/project-rows.ts';
import { projectStore } from './projects.ts';

const AT = new Date('2026-03-12T10:00:00Z');

let db: Database;
let close: () => Promise<void>;
let accountId: number;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase({ linkRoots: false }));
  const [row] = await db
    .insert(account)
    .values({
      email: 'ada@example.test',
      name: 'Ada',
      passwordHash: 'x',
      role: 'manager',
      createdAt: AT,
    })
    .returning({ id: account.id });
  accountId = row?.id ?? 0;
});

afterEach(async () => {
  await close();
});

async function send(threads: unknown[]) {
  const checked = checkBatch({ parserVersion: 1, threads });
  if (checked.status !== 'ok') throw new Error(JSON.stringify(checked));
  return storeBatch(db, checked.batch, { accountId, machine: 'laptop' });
}

async function sessionIds(): Promise<string[]> {
  return (await db.select({ id: session.id }).from(session))
    .map((row) => row.id)
    .sort();
}

describe('removing a project whose sessions came from the CLI', () => {
  it('deletes the sessions linked by their own remote, their CLI offsets, the role rules and the git host data and reports of their roots, and the CLI skips them afterwards', async () => {
    const store = projectStore(db, () => AT);
    const added = await store.add(
      { name: 'Shop', remote: NORMAL_REMOTE, slug: 'shop' },
      accountId,
    );
    if (added.status !== 'added') throw new Error('Project not added');
    await send([mainThread('cli-1'), subAgentThread('cli-1', 'a1')]);
    expect(await store.list()).toMatchObject([{ slug: 'shop', sessions: 1 }]);
    const root = '/work/shop-clone';
    await db.update(session).set({ project: root });
    expect(await db.select().from(rootRemote)).toEqual([]);
    await seedGitHostRows(db, NORMAL_REMOTE);
    await db
      .update(gitHostProject)
      .set({ error: 'gh: 401' })
      .where(eq(gitHostProject.remote, NORMAL_REMOTE));
    await db.insert(markedReport).values({
      project: root,
      reportedAt: AT,
      period: '7d',
      filters: { kind: null, role: null, session: null, issue: null },
      groups: [],
    });
    expect(await db.select().from(projectRule)).not.toEqual([]);

    expect(await store.remove(added.project.id)).toBe('removed');

    expect(await sessionIds()).toEqual([]);
    expect(await db.select().from(ingestFile)).toEqual([]);
    expect(await db.select().from(projectRule)).toEqual([]);
    expect(await db.select().from(project)).toEqual([]);
    for (const table of [gitHostIssue, gitHostRequest, gitHostProject]) {
      expect(await db.select().from(table)).toEqual([]);
    }
    expect(await db.select().from(markedReport)).toEqual([]);
    expect(
      (await db.select().from(removedSession)).map((row) => row.sessionId),
    ).toEqual(['cli-1']);

    const result = await send([
      mainThread('cli-1', { firstAt: minutes(40) }),
      subAgentThread('cli-1', 'a1'),
      mainThread('cli-2'),
    ]);

    expect(result).toMatchObject({ status: 'stored', sessions: 1, threads: 1 });
    expect(await sessionIds()).toEqual(['cli-2']);
    expect(
      (await db.select({ id: apiCall.sessionId }).from(apiCall)).every(
        (row) => row.id === 'cli-2',
      ),
    ).toBe(true);
  });
});
