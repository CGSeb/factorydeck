import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import {
  account,
  apiCall,
  closingLine,
  friction,
  gitHostIssue,
  gitHostProject,
  gitHostRequest,
  markedReport,
  project,
  removedSession,
  rootRemote,
  session,
  skillLaunch,
  skippedFile,
  sourceFile,
  subAgent,
  userPrompt,
} from '../db/schema.ts';
import { saveFailure } from '../git-host/store.ts';
import { LOCK_KEY } from '../ingest/lock.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { seedGitHostRows, seedSessionRows } from '../test/project-rows.ts';
import { projectStore } from './projects.ts';
import { PROJECT_LOCK, removeProject } from './remove-project.ts';

const AT = new Date('2026-03-12T10:00:00Z');
const REMOVED_AT = new Date('2026-03-14T08:00:00Z');
const SHOP = 'github.com/example-org/shop';
const LIB = 'github.com/example-org/lib';
const STRAY = 'github.com/example-org/stray';

let db: Database;
let close: () => Promise<void>;
let shopId: number;
let libId: number;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase({ linkRoots: false }));
  const rows = await db
    .insert(project)
    .values([
      { name: 'Shop', slug: 'shop', remote: SHOP, createdAt: AT },
      { name: 'Lib', slug: 'lib', remote: LIB, createdAt: AT },
    ])
    .returning({ id: project.id, slug: project.slug });
  shopId = rows.find((row) => row.slug === 'shop')?.id ?? 0;
  libId = rows.find((row) => row.slug === 'lib')?.id ?? 0;
  await db.insert(rootRemote).values([
    { root: '/work/shop', remote: SHOP },
    { root: '/home/dev/shop', remote: SHOP },
    { root: '/work/lib', remote: LIB },
    { root: '/work/stray', remote: STRAY },
  ]);
  await seedSessionRows(db, 's1', '/work/shop');
  await seedSessionRows(db, 's2', '/home/dev/shop');
  await seedSessionRows(db, 'k1', '/work/lib');
  await seedSessionRows(db, 'u1', '/work/stray');
  for (const root of ['/work/shop', '/work/lib']) {
    await seedGitHostRows(db, root);
  }
  await db.insert(markedReport).values(
    ['shop', '/work/shop', 'lib', '/work/lib'].map((key) => ({
      project: key,
      reportedAt: AT,
      period: '7d',
      filters: { kind: null, role: null, session: null, issue: null },
      groups: [],
    })),
  );
  await db.insert(sourceFile).values({
    path: '/logs/p/s1.jsonl',
    sizeBytes: 10,
    readOffset: 10,
  });
  await db.insert(skippedFile).values({
    path: '/logs/p/s9.jsonl',
    sessionId: 's9',
    sizeBytes: 5,
    project: '/work/shop',
  });
});

afterEach(async () => {
  await close();
});

async function sessionsOf(
  table:
    | typeof subAgent
    | typeof apiCall
    | typeof skillLaunch
    | typeof userPrompt
    | typeof closingLine
    | typeof friction,
): Promise<string[]> {
  return (await db.select({ id: table.sessionId }).from(table))
    .map((row) => row.id)
    .sort();
}

async function projectsOf(
  table: typeof gitHostIssue | typeof gitHostRequest | typeof gitHostProject,
): Promise<string[]> {
  return (await db.select({ project: table.project }).from(table))
    .map((row) => row.project)
    .sort();
}

describe('removing a project', () => {
  it('deletes the project and every stored row of its remote, and only those', async () => {
    expect(await removeProject(db, shopId, REMOVED_AT)).toBe('removed');

    const kept = ['k1', 'u1'];
    expect(
      (await db.select({ id: session.id }).from(session))
        .map((row) => row.id)
        .sort(),
    ).toEqual(kept);
    for (const table of [
      subAgent,
      apiCall,
      skillLaunch,
      userPrompt,
      closingLine,
      friction,
    ]) {
      expect(await sessionsOf(table)).toEqual(kept);
    }
    for (const table of [gitHostIssue, gitHostRequest, gitHostProject]) {
      expect(await projectsOf(table)).toEqual(['/work/lib']);
    }
    expect(
      (await db.select({ project: markedReport.project }).from(markedReport))
        .map((row) => row.project)
        .sort(),
    ).toEqual(['/work/lib', 'lib']);
    expect(
      (await db.select().from(rootRemote)).map((row) => row.root).sort(),
    ).toEqual(['/work/lib', '/work/stray']);
    expect((await db.select().from(project)).map((row) => row.slug)).toEqual([
      'lib',
    ]);
    expect(
      (await db.select().from(removedSession)).sort((a, b) =>
        a.sessionId.localeCompare(b.sessionId),
      ),
    ).toEqual([
      { sessionId: 's1', projectName: 'Shop', removedAt: REMOVED_AT },
      { sessionId: 's2', projectName: 'Shop', removedAt: REMOVED_AT },
    ]);
    expect(await db.select({ path: sourceFile.path }).from(sourceFile)).toEqual(
      [{ path: '/logs/p/s1.jsonl' }],
    );
    expect(
      await db.select({ path: skippedFile.path }).from(skippedFile),
    ).toEqual([{ path: '/logs/p/s9.jsonl' }]);
  });

  it('frees the slug and the remote: adding the remote again makes a new project with no session', async () => {
    const [manager] = await db
      .insert(account)
      .values({
        email: 'ada@example.test',
        name: 'Ada',
        passwordHash: 'x',
        role: 'manager',
        createdAt: AT,
      })
      .returning({ id: account.id });
    const store = projectStore(db, () => REMOVED_AT);
    await store.remove(shopId);

    const added = await store.add(
      { name: 'Shop', remote: SHOP, slug: 'shop' },
      manager?.id ?? 0,
    );

    expect(added.status).toBe('added');
    if (added.status !== 'added') return;
    expect(added.project.slug).toBe('shop');
    expect(added.project.id).not.toBe(shopId);
    expect(
      (await store.list()).map(({ slug, sessions }) => [slug, sessions]),
    ).toEqual([
      ['lib', 1],
      ['shop', 0],
    ]);
  });

  it('answers not-found for an unknown project, and removes nothing', async () => {
    expect(await removeProject(db, shopId + libId + 10, REMOVED_AT)).toBe(
      'not-found',
    );
    expect(await db.select().from(session)).toHaveLength(4);
  });

  it('lists every stored session of each project, whatever the period', async () => {
    await db.insert(session).values({ id: 's3', project: '/work/shop' });

    const listed = await projectStore(db).list();

    expect(listed.map(({ slug, sessions }) => [slug, sessions])).toEqual([
      ['lib', 1],
      ['shop', 3],
    ]);
  });

  it.each([
    ['ingestion', LOCK_KEY],
    ['project', PROJECT_LOCK],
  ])(
    'answers busy when the %s lock stays taken past the wait, and removes nothing',
    async (_name, key) => {
      let release = (): void => undefined;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      let locked = (): void => undefined;
      const taken = new Promise<void>((resolve) => {
        locked = resolve;
      });
      const holder = db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(${key})`);
        locked();
        await held;
      });
      await taken;

      expect(await removeProject(db, shopId, REMOVED_AT, 200)).toBe('busy');

      release();
      await holder;
      expect(await db.select().from(project)).toHaveLength(2);
      expect(await db.select().from(session)).toHaveLength(4);
    },
  );

  it('waits for a running ingestion, then removes', async () => {
    let release = (): void => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let locked = (): void => undefined;
    const taken = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const ingestion = db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_KEY})`);
      locked();
      await held;
    });
    await taken;
    let finished = false;
    const removal = removeProject(db, shopId, REMOVED_AT).then((result) => {
      finished = true;
      return result;
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(finished).toBe(false);
    release();
    await ingestion;
    expect(await removal).toBe('removed');
  });

  it('lets a git host collection that was running write nothing for the removed project', async () => {
    await removeProject(db, shopId, REMOVED_AT);

    await saveFailure(db, '/work/shop', 'github', 'gh: 401');

    expect(await projectsOf(gitHostProject)).toEqual(['/work/lib']);
  });
});
