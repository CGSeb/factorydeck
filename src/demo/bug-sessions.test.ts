import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { ingest } from '../ingest/ingest.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import { listRoles } from '../roles/query.ts';
import { sessionDetail } from '../sessions/query.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { sessionsFolder } from '../test/session-logs.ts';
import { BUG_ISSUE, REPORTED_BUG } from './bug-sessions.ts';
import { writeDemoSessions } from './sessions.ts';

const NOW = new Date('2026-03-12T15:30:00Z');
const state = { inactiveAfterMinutes: 30, now: NOW };

let db: Database;
let close: () => Promise<void>;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
  const folder = await sessionsFolder();
  await writeDemoSessions(folder, NOW, await sessionsFolder());
  await ingest(db, folder, { wsl: false });
});

afterEach(async () => {
  await close();
});

describe('demo bug sessions', () => {
  it('give the fix-bug sub-agents their default roles and the bug as work item', async () => {
    const fix = await sessionDetail(
      db,
      'demo-app-fix-bug',
      state,
      DEFAULT_CONFIG,
    );
    const issue = `#${String(BUG_ISSUE)}`;
    expect(
      fix?.subAgents
        .map((agent) => [agent.description, agent.role, agent.workItem])
        .sort(),
    ).toEqual([
      [`Debug ${issue}`, 'debugger', BUG_ISSUE],
      [`Review ${issue}`, 'reviewer', BUG_ISSUE],
      [`Ship ${issue}`, 'shipper', BUG_ISSUE],
      [`check-bug ${issue}`, 'bug-checker', BUG_ISSUE],
    ]);
  });

  it('counts the bug report under the bug-reporter marker role', async () => {
    const report = await sessionDetail(
      db,
      'demo-app-report-bug',
      state,
      DEFAULT_CONFIG,
    );
    expect(report?.workItem).toBe(REPORTED_BUG);
    const list = await listRoles(
      db,
      { period: 'all', timeZone: 'UTC', now: NOW },
      DEFAULT_CONFIG,
    );
    expect(
      list.roles.find((row) => row.role === 'bug-reporter')?.apiCalls,
    ).toBe(2);
  });
});
