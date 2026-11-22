import { mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { asc } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import {
  apiCall,
  ingestState,
  session,
  skillLaunch,
  sourceFile,
  subAgent,
  userPrompt,
} from '../db/schema.ts';
import { listSessions } from '../sessions/query.ts';
import { listSkills } from '../skills/query.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  appendLog,
  assistant,
  installFactory,
  sessionsFolder,
  skillCall,
  userText,
  writeLog,
} from '../test/session-logs.ts';
import { factoryFile } from './factory.ts';
import { ingest, summaryLine } from './ingest.ts';

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

async function project(name: string, factory: boolean): Promise<string> {
  const root = join(work, name);
  await mkdir(root, { recursive: true });
  if (factory) await installFactory(root);
  return root;
}

function logPath(id: string): string {
  return join(logs, 'p', `${id}.jsonl`);
}

function turn(id: string, n: number, cwd: string | undefined) {
  const ctx = {
    uuid: `${id}-${String(n)}`,
    at: n,
    ...(cwd === undefined ? {} : { cwd }),
  };
  return [
    userText(ctx, `Prompt ${String(n)}`),
    assistant(ctx, {
      requestId: `${id}-req-${String(n)}`,
      content: [skillCall('kit:check')],
    }),
  ];
}

async function writeSession(
  id: string,
  cwd: string | undefined,
  turns = 1,
): Promise<void> {
  await writeLog(
    logPath(id),
    Array.from({ length: turns }, (_, n) => turn(id, n, cwd)).flat(),
  );
}

async function run(): Promise<string> {
  return summaryLine(await ingest(db, logs));
}

async function storedSessions(): Promise<[string, string][]> {
  const rows = await db.select().from(session).orderBy(asc(session.id));
  return rows.map((row) => [row.id, row.project]);
}

describe('factory projects only', () => {
  it('stores sessions of factory projects and skips the others, counted', async () => {
    const factory = await project('factory-app', true);
    const plain = await project('plain-app', false);
    await writeSession('in-factory', factory);
    await writeSession('in-plain', plain);
    await writeSession('no-cwd', undefined);
    await writeSession('gone', join(work, 'removed-app'));
    await writeLog(join(logs, 'p', 'in-plain', 'subagents', 'agent-x.jsonl'), [
      assistant(
        { uuid: 'x', at: 1, cwd: plain, sidechain: true },
        { requestId: 'x' },
      ),
    ]);

    expect(await run()).toBe(
      'Ingested 1 files: 1 sessions, 0 sub-agents, 1 API calls, 1 skill launches, 0 lines skipped, 3 sessions skipped (no factory).',
    );
    expect(await storedSessions()).toEqual([['in-factory', factory]]);
    const all = { period: 'all', timeZone: 'UTC' } as const;
    expect((await listSkills(db, all)).projects).toEqual([
      { project: factory, name: 'factory-app' },
    ]);
    expect(
      (
        await listSessions(
          db,
          { ...all, limit: 10 },
          { inactiveAfterMinutes: 30 },
        )
      ).projects,
    ).toEqual([{ project: factory, name: 'factory-app' }]);
    expect(await db.select().from(subAgent)).toEqual([]);
    expect(await db.select().from(userPrompt)).toHaveLength(1);
    expect((await db.select().from(sourceFile)).map((row) => row.path)).toEqual(
      [logPath('in-factory')],
    );
  });

  it('does not read a skipped log again until it grows, and says Nothing new', async () => {
    const plain = await project('plain-app', false);
    const other = await project('other-app', true);
    await writeSession('later', plain);
    expect(await run()).toMatch(/, 1 sessions skipped \(no factory\)\.$/);
    expect(await run()).toBe('Nothing new.');

    const content = await readFile(logPath('later'), 'utf8');
    await writeFile(logPath('later'), content.replaceAll(plain, other));
    expect(await run()).toBe('Nothing new.');
    expect(await storedSessions()).toEqual([]);

    await appendLog(logPath('later'), turn('later', 5, other));
    expect(await run()).toMatch(/^Ingested 1 files: 1 sessions,/);
    expect(await storedSessions()).toEqual([['later', other]]);
  });

  it('reads every line of a skipped log once its project gains the factory', async () => {
    const root = await project('app', false);
    await writeSession('early', root, 3);
    expect(await run()).toMatch(/, 1 sessions skipped \(no factory\)\.$/);
    expect(await db.select().from(apiCall)).toEqual([]);

    await installFactory(root);
    expect(await run()).toBe(
      'Ingested 1 files: 1 sessions, 0 sub-agents, 3 API calls, 3 skill launches, 0 lines skipped, 0 sessions skipped (no factory).',
    );
    expect(await storedSessions()).toEqual([['early', root]]);
    expect(await db.select().from(userPrompt)).toHaveLength(3);
    expect(await db.select().from(skillLaunch)).toHaveLength(3);
  });

  it('keeps the data of a project that lost its factory and skips its new sessions', async () => {
    const root = await project('app', true);
    await writeSession('kept', root);
    await run();
    await rm(factoryFile(root));

    await writeSession('new', root);
    await appendLog(logPath('kept'), turn('kept', 4, root));
    expect(await run()).toBe(
      'Ingested 0 files: 0 sessions, 0 sub-agents, 0 API calls, 0 skill launches, 0 lines skipped, 2 sessions skipped (no factory).',
    );
    expect(await run()).toBe('Nothing new.');
    expect(await storedSessions()).toEqual([['kept', root]]);
    expect(await db.select().from(apiCall)).toHaveLength(1);

    await rm(root, { recursive: true });
    expect(await run()).toBe('Nothing new.');
    expect(await storedSessions()).toEqual([['kept', root]]);
  });

  it('resumes a project from its stored offsets when its factory comes back', async () => {
    const root = await project('app', true);
    await writeSession('kept', root);
    await run();
    await rm(factoryFile(root));
    await appendLog(logPath('kept'), turn('kept', 4, root));
    await run();

    await installFactory(root);
    expect(await run()).toBe(
      'Ingested 1 files: 1 sessions, 0 sub-agents, 1 API calls, 1 skill launches, 0 lines skipped, 0 sessions skipped (no factory).',
    );
    expect(await db.select().from(apiCall)).toHaveLength(2);
  });

  it('removes data of projects without the factory once, at the first run after the upgrade', async () => {
    const factory = await project('factory-app', true);
    const plain = await project('plain-app', false);
    await db
      .insert(session)
      .values([
        { id: 'old-factory', project: factory, cwd: factory },
        { id: 'old-plain', project: plain, cwd: plain },
        { id: 'old-unassigned' },
      ]);
    await db
      .insert(ingestState)
      .values({ id: 'ingestion', branchesReadDone: true });
    await db.insert(sourceFile).values([
      { path: logPath('old-factory'), sizeBytes: 1, readOffset: 1 },
      { path: logPath('old-plain'), sizeBytes: 1, readOffset: 1 },
      {
        path: join(logs, 'p', 'old-plain', 'subagents', 'agent-a.meta.json'),
        sizeBytes: 1,
        readOffset: 1,
      },
    ]);
    expect(await run()).toBe('Nothing new.');
    expect(await storedSessions()).toEqual([['old-factory', factory]]);
    expect((await db.select().from(sourceFile)).map((row) => row.path)).toEqual(
      [logPath('old-factory')],
    );

    await rm(factoryFile(factory));
    await run();
    expect(await storedSessions()).toEqual([['old-factory', factory]]);
  });
});
