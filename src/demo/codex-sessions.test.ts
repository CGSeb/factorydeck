import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { friction } from '../db/schema.ts';
import { ingest } from '../ingest/ingest.ts';
import { listSessions, sessionDetail } from '../sessions/query.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { sessionsFolder } from '../test/session-logs.ts';
import {
  CODEX_BUILD_ID,
  CODEX_CHAT_ID,
  CODEX_EXPLORER_ID,
  CODEX_WORKER_ID,
  CODEX_WORK_ITEM,
  writeDemoCodexSessions,
} from './codex-sessions.ts';
import { EXAMPLE_APP, demoProjectRoot, writeDemoSessions } from './sessions.ts';

const NOW = new Date('2026-03-12T15:30:00Z');

let db: Database;
let close: () => Promise<void>;
let projects: string;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
  const folder = await sessionsFolder();
  const codexFolder = await sessionsFolder();
  projects = await sessionsFolder();
  await writeDemoSessions(folder, NOW, projects);
  await writeDemoCodexSessions(
    codexFolder,
    NOW,
    demoProjectRoot(projects, EXAMPLE_APP),
  );
  await ingest(db, folder, { codexFolder, wsl: false });
});

afterEach(async () => {
  await close();
});

function byId(a: string[], b: string[]): number {
  return (a[0] ?? '').localeCompare(b[0] ?? '');
}

describe('demo sessions of Codex', () => {
  it('cover two Codex sessions, a marker, a failed command and two sub-agents', async () => {
    const state = { inactiveAfterMinutes: 30, now: NOW };
    const app = demoProjectRoot(projects, EXAMPLE_APP);
    const query = { period: 'all' as const, timeZone: 'UTC', now: NOW };
    const list = await listSessions(db, { ...query, limit: 500 }, state);
    const codex = list.sessions.filter((row) => row.agent === 'codex');
    expect(codex.map((row) => [row.id, row.project]).sort(byId)).toEqual([
      [CODEX_BUILD_ID, app],
      [CODEX_CHAT_ID, app],
    ]);
    expect(list.agents).toEqual(['claude-code', 'codex']);
    const build = await sessionDetail(db, CODEX_BUILD_ID, state);
    expect(build?.workItem).toBe(CODEX_WORK_ITEM);
    expect(
      build?.subAgents
        .map((row) => [row.id, row.agentType, row.role])
        .sort(byId),
    ).toEqual(
      [
        [CODEX_WORKER_ID, 'worker', 'worker'],
        [CODEX_EXPLORER_ID, 'explorer', 'explorer'],
      ].sort(byId),
    );
    const failed = await db
      .select()
      .from(friction)
      .where(eq(friction.agent, 'codex'));
    expect(failed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sessionId: CODEX_BUILD_ID,
          category: 'command-failed',
          program: 'pnpm',
        }),
        expect.objectContaining({
          sessionId: CODEX_CHAT_ID,
          kind: 'compaction',
        }),
      ]),
    );
  });
});
