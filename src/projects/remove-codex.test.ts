import { mkdir, realpath, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { apiCall, session, sourceFile, subAgent } from '../db/schema.ts';
import { factoryFile, hasFactory } from '../ingest/factory.ts';
import { ingest, summaryLine } from '../ingest/ingest.ts';
import {
  rolloutPath,
  sessionMeta,
  turnContext,
  usageRecord,
} from '../test/codex-logs.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  installFactory,
  sessionsFolder,
  writeLog,
} from '../test/session-logs.ts';
import { deleteProject } from './remove.ts';

let db: Database;
let close: () => Promise<void>;
let claude: string;
let codex: string;
let root: string;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
  claude = await sessionsFolder();
  codex = await sessionsFolder();
  root = join(await realpath(await sessionsFolder()), 'app');
  await mkdir(root, { recursive: true });
  await installFactory(root);
  await writeLog(rolloutPath(codex, 'codex-root'), [
    sessionMeta({ id: 'codex-root', cwd: root }),
    turnContext(1, 'gpt-test-1'),
    usageRecord(2, 'resp_1', { input: 10, output: 1 }),
  ]);
  await writeLog(rolloutPath(codex, 'codex-sub'), [
    sessionMeta({
      id: 'codex-sub',
      sessionId: 'codex-root',
      parent: 'codex-root',
      role: 'worker',
      cwd: root,
      at: 3,
    }),
    usageRecord(4, 'resp_2', { input: 5, output: 1 }),
  ]);
});

afterEach(async () => {
  await close();
});

async function run(): Promise<string> {
  return summaryLine(
    await ingest(db, claude, { codexFolder: codex, wsl: false }),
  );
}

describe('deleting a project with Codex sessions', () => {
  it('forgets the rollouts read offsets, then reads them again once its factory is back', async () => {
    await run();
    await rm(factoryFile(root));
    expect(await deleteProject(db, root, hasFactory)).toBe('deleted');
    expect(await db.select().from(sourceFile)).toEqual([]);
    expect(await run()).toMatch(/, 1 sessions skipped \(no factory\)\.$/);
    expect(await db.select().from(session)).toEqual([]);
    await installFactory(root);
    expect(await run()).toBe(
      'Ingested 2 files: 1 sessions, 1 sub-agents, 2 API calls, 0 skill launches, 0 frictions, 0 lines skipped, 0 sessions skipped (no factory).',
    );
    expect((await db.select().from(subAgent))[0]?.agentType).toBe('worker');
    expect(await db.select().from(apiCall)).toHaveLength(2);
  });
});
