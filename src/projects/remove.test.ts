import { mkdir, realpath, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import {
  apiCall,
  gitHostIssue,
  gitHostProject,
  gitHostRequest,
  session,
  skillLaunch,
  sourceFile,
  subAgent,
  userPrompt,
} from '../db/schema.ts';
import { factoryFile, hasFactory } from '../ingest/factory.ts';
import { LOCK_KEY, ingest, summaryLine } from '../ingest/ingest.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  assistant,
  installFactory,
  sessionsFolder,
  skillCall,
  userText,
  writeLog,
} from '../test/session-logs.ts';
import { deleteProject, factoryStatus } from './remove.ts';

let db: Database;
let close: () => Promise<void>;
let logs: string;
let work: string;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
  logs = await sessionsFolder();
  work = await realpath(await sessionsFolder());
});

afterEach(async () => {
  await close();
});

async function factoryProject(name: string): Promise<string> {
  const root = join(work, name);
  await mkdir(root, { recursive: true });
  await installFactory(root);
  return root;
}

async function writeSession(id: string, cwd: string): Promise<void> {
  const ctx = (n: number, sidechain = false) => ({
    uuid: `${id}-${String(n)}`,
    at: n,
    cwd,
    sidechain,
  });
  await writeLog(join(logs, 'p', `${id}.jsonl`), [
    userText(ctx(0), 'Build it'),
    assistant(ctx(1), { requestId: `${id}-1`, content: [skillCall('kit:a')] }),
  ]);
  const agents = join(logs, 'p', id, 'subagents');
  await writeLog(join(agents, 'agent-x.jsonl'), [
    assistant(ctx(2, true), {
      requestId: `${id}-2`,
      content: [skillCall('kit:b')],
    }),
  ]);
  await writeLog(join(agents, 'agent-x.meta.json'), [{ agentType: 'helper' }]);
}

async function counts(): Promise<Record<string, number>> {
  return {
    sessions: (await db.select().from(session)).length,
    subAgents: (await db.select().from(subAgent)).length,
    apiCalls: (await db.select().from(apiCall)).length,
    skillLaunches: (await db.select().from(skillLaunch)).length,
    prompts: (await db.select().from(userPrompt)).length,
    sourceFiles: (await db.select().from(sourceFile)).length,
  };
}

describe('deleting a project', () => {
  it('removes every row and read offset of a project without its factory, and nothing else', async () => {
    const gone = await factoryProject('gone-app');
    const kept = await factoryProject('kept-app');
    await writeSession('g1', gone);
    await writeSession('k1', kept);
    await ingest(db, logs);
    await rm(factoryFile(gone));
    expect(await factoryStatus(db, hasFactory)).toEqual({
      hasSessions: true,
      missing: [
        {
          project: gone,
          name: 'gone-app',
          factoryFile: factoryFile(gone),
          sessions: 1,
        },
      ],
      projects: [
        { project: gone, name: 'gone-app' },
        { project: kept, name: 'kept-app' },
      ],
      bugTickets: [],
    });

    expect(await deleteProject(db, gone, hasFactory)).toBe('deleted');
    expect((await factoryStatus(db, hasFactory)).projects).toEqual([
      { project: gone, name: 'gone-app' },
      { project: kept, name: 'kept-app' },
    ]);
    expect(await counts()).toEqual({
      sessions: 1,
      subAgents: 1,
      apiCalls: 2,
      skillLaunches: 2,
      prompts: 1,
      sourceFiles: 3,
    });
    expect((await db.select().from(session)).map((row) => row.project)).toEqual(
      [kept],
    );
    expect(
      (await db.select().from(sourceFile)).every((row) =>
        row.path.includes('k1'),
      ),
    ).toBe(true);
    expect((await factoryStatus(db, hasFactory)).missing).toEqual([]);
  });

  it('deletes the issues and requests collected for the project, and no other', async () => {
    const gone = await factoryProject('gone-app');
    const kept = await factoryProject('kept-app');
    await writeSession('g1', gone);
    await writeSession('k1', kept);
    await ingest(db, logs);
    const at = new Date('2026-03-01T10:00:00Z');
    for (const project of [gone, kept]) {
      await db.insert(gitHostIssue).values({
        project,
        number: 1,
        title: 'Issue',
        state: 'open',
        labels: [],
        url: 'https://example.invalid/issues/1',
        createdAt: at,
        updatedAt: at,
      });
      await db.insert(gitHostRequest).values({
        project,
        number: 2,
        title: 'Request',
        state: 'open',
        draft: false,
        headBranch: 'feat/1',
        url: 'https://example.invalid/pull/2',
        createdAt: at,
        updatedAt: at,
        closes: [1],
        checks: 'none',
      });
      await db
        .insert(gitHostProject)
        .values({ project, gitHost: 'github', syncedFrom: at });
    }
    await rm(factoryFile(gone));
    expect(await deleteProject(db, gone, hasFactory)).toBe('deleted');
    for (const table of [gitHostIssue, gitHostRequest, gitHostProject]) {
      expect(
        (await db.select({ project: table.project }).from(table)).map(
          (row) => row.project,
        ),
      ).toEqual([kept]);
    }
  });

  it('skips the logs of a deleted project, then reads them from the first line once its factory is back', async () => {
    const root = await factoryProject('app');
    await writeSession('s1', root);
    await ingest(db, logs);
    await rm(factoryFile(root));
    await deleteProject(db, root, hasFactory);

    expect(summaryLine(await ingest(db, logs))).toMatch(
      /, 1 sessions skipped \(no factory\)\.$/,
    );
    expect((await counts()).sessions).toBe(0);
    await installFactory(root);
    expect(summaryLine(await ingest(db, logs))).toBe(
      'Ingested 3 files: 1 sessions, 1 sub-agents, 2 API calls, 2 skill launches, 0 frictions, 0 lines skipped, 0 sessions skipped (no factory).',
    );
    expect((await db.select().from(subAgent))[0]?.agentType).toBe('helper');
  });

  it('refuses a project whose factory is found again, and an unknown project', async () => {
    const root = await factoryProject('app');
    await writeSession('s1', root);
    await ingest(db, logs);
    const before = await counts();

    expect(await deleteProject(db, root, hasFactory)).toBe('has-factory');
    expect(await deleteProject(db, join(work, 'other'), hasFactory)).toBe(
      'not-found',
    );
    expect(await counts()).toEqual(before);
  });

  it('waits for a running ingestion before deleting', async () => {
    const root = await factoryProject('app');
    await writeSession('s1', root);
    await ingest(db, logs);
    await rm(factoryFile(root));
    let release = (): void => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let locked = (): void => undefined;
    const lockTaken = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const ingestion = db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_KEY})`);
      locked();
      await held;
    });
    await lockTaken;
    let finished = false;
    const deletion = deleteProject(db, root, hasFactory).then((result) => {
      finished = true;
      return result;
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(finished).toBe(false);
    release();
    await ingestion;
    expect(await deletion).toBe('deleted');
  });

  it('lists projects without their factory by name, and says when no session is stored', async () => {
    expect(await factoryStatus(db, hasFactory)).toEqual({
      hasSessions: false,
      missing: [],
      projects: [],
      bugTickets: [],
    });
    await db.insert(session).values([
      { id: 'a', project: '/gone/zeta' },
      { id: 'b', project: '/gone/alpha' },
      { id: 'c', project: '/gone/alpha' },
    ]);
    const status = await factoryStatus(db, hasFactory);
    expect(status.missing.map((row) => [row.name, row.sessions])).toEqual([
      ['alpha', 2],
      ['zeta', 1],
    ]);
    expect(status.projects).toEqual([
      { project: '/gone/alpha', name: 'alpha' },
      { project: '/gone/zeta', name: 'zeta' },
    ]);
  });

  it('lists the collected projects that have a bug label', async () => {
    const syncedFrom = new Date('2026-03-01T10:00:00Z');
    await db.insert(gitHostProject).values([
      { project: '/work/zeta', bugLabel: 'bug', syncedFrom },
      { project: '/work/alpha', bugLabel: 'defect', syncedFrom },
      { project: '/work/plain', bugLabel: null, syncedFrom },
      { project: '/work/failed', bugLabel: 'bug', syncedFrom: null },
    ]);
    expect((await factoryStatus(db, hasFactory)).bugTickets).toEqual([
      '/work/alpha',
      '/work/zeta',
    ]);
  });

  it('drops a deleted project from the bug tickets', async () => {
    const gone = await factoryProject('gone-app');
    const kept = await factoryProject('kept-app');
    await writeSession('g1', gone);
    await writeSession('k1', kept);
    await ingest(db, logs);
    const syncedFrom = new Date('2026-03-01T10:00:00Z');
    await db.insert(gitHostProject).values([
      { project: gone, bugLabel: 'bug', syncedFrom },
      { project: kept, bugLabel: 'bug', syncedFrom },
    ]);
    await rm(factoryFile(gone));
    expect((await factoryStatus(db, hasFactory)).bugTickets).toEqual(
      [gone, kept].sort(),
    );
    expect(await deleteProject(db, gone, hasFactory)).toBe('deleted');
    expect((await factoryStatus(db, hasFactory)).bugTickets).toEqual([kept]);
  });
});
