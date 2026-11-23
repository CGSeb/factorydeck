import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { listFeatures } from '../features/query.ts';
import type { FeatureQuery } from '../features/types.ts';
import { usageOverview } from '../overview/query.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import { listRoles } from '../roles/query.ts';
import { listSessions } from '../sessions/query.ts';
import {
  rolloutPath,
  sessionMeta,
  taskComplete,
  taskStarted,
  turnContext,
  usageRecord,
  userMessage,
} from '../test/codex-logs.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  EVERY_PROJECT_HAS_FACTORY,
  appendLog,
  assistant,
  sessionsFolder,
  userText,
  writeLog,
} from '../test/session-logs.ts';
import { ingest } from './ingest.ts';

const NOW = new Date('2026-01-06T12:00:00Z');
const state = { inactiveAfterMinutes: 30, now: NOW };

let db: Database;
let close: () => Promise<void>;
let claude: string;
let codex: string;
let work: string;
let query: FeatureQuery;

async function run(): Promise<void> {
  await ingest(db, claude, {
    ...EVERY_PROJECT_HAS_FACTORY,
    codexFolder: codex,
    wsl: false,
  });
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  claude = await sessionsFolder();
  codex = await sessionsFolder();
  work = await sessionsFolder();
  query = { period: 'all', timeZone: 'UTC', project: work, now: NOW };
  await writeLog(join(claude, 'p', 'claude-1.jsonl'), [
    userText({ uuid: 'u1', at: 0, cwd: work }, 'Review #5'),
    assistant(
      { uuid: 'a1', at: 1, cwd: work },
      {
        requestId: 'req_c1',
        tokens: [100, 0, 0, 10],
        content: [{ type: 'text', text: 'Work item: #5 (reviewer)' }],
      },
    ),
    assistant(
      { uuid: 'a2', at: 2, cwd: work },
      { requestId: 'req_c2', tokens: [100, 0, 0, 10] },
    ),
  ]);
  await writeLog(rolloutPath(codex, 'codex-1'), [
    sessionMeta({ id: 'codex-1', cwd: work }),
    turnContext(3, 'gpt-test-1'),
    taskStarted(3),
    userMessage(3),
    usageRecord(4, 'resp_1', { input: 40, output: 4 }),
    taskComplete(5, 'Built it.\nWork item: #6 (worker)'),
    taskStarted(6),
    usageRecord(7, 'resp_2', { input: 60, output: 6 }),
  ]);
  await run();
});

afterAll(async () => {
  await close();
});

function callsByIssue(rows: { number: number; apiCalls: number }[]) {
  return Object.fromEntries(rows.map((row) => [row.number, row.apiCalls]));
}

describe('Claude Code and Codex sessions together', () => {
  it('counts both agents in the overview, features and roles', async () => {
    const [overview, features, roles] = await Promise.all([
      usageOverview(db, query),
      listFeatures(db, query, DEFAULT_CONFIG),
      listRoles(db, query, DEFAULT_CONFIG),
    ]);
    expect(overview.totals.sessions).toBe(2);
    expect(overview.totals.apiCalls).toBe(4);
    expect(features.totals.apiCalls).toBe(4);
    expect(features.totals.sessions).toBe(2);
    expect(roles.apiCalls).toBe(4);
  });

  it('gives the calls after a Codex marker to its issue and role', async () => {
    const features = await listFeatures(db, query, DEFAULT_CONFIG);
    expect(callsByIssue(features.rows)).toEqual({ 5: 2, 6: 2 });
    const six = features.rows.find((row) => row.number === 6);
    expect(six?.roles.map((role) => role.role)).toEqual(['worker']);
    const roles = await listRoles(db, query, DEFAULT_CONFIG);
    expect(
      Object.fromEntries(roles.roles.map((role) => [role.role, role.apiCalls])),
    ).toMatchObject({ reviewer: 2, worker: 2 });
  });

  it('lists both agents, and adds the calls of a grown Codex rollout', async () => {
    const before = await listSessions(
      db,
      { ...query, limit: 50 },
      state,
      DEFAULT_CONFIG,
    );
    expect(before.agents).toEqual(['claude-code', 'codex']);
    expect(
      Object.fromEntries(before.sessions.map((row) => [row.id, row.agent])),
    ).toEqual({ 'claude-1': 'claude-code', 'codex-1': 'codex' });
    await appendLog(rolloutPath(codex, 'codex-1'), [
      usageRecord(8, 'resp_3', { input: 5, output: 1 }),
    ]);
    await run();
    const overview = await usageOverview(db, query);
    expect(overview.totals.apiCalls).toBe(5);
    expect(overview.totals.sessions).toBe(2);
  });
});
