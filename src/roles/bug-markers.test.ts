import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { apiCall, closingLine, session } from '../db/schema.ts';
import { listFeatures } from '../features/query.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { DEFAULT_CONFIG } from './config.ts';
import { listRoles } from './query.ts';

const PROJECT = '/work/bug-app';
const NOW = new Date('2026-05-20T12:00:00Z');
const query = {
  period: 'all' as const,
  timeZone: 'UTC',
  project: PROJECT,
  now: NOW,
};

function at(hour: number): Date {
  return new Date(`2026-05-19T${String(hour).padStart(2, '0')}:00:00Z`);
}

function call(hour: number) {
  return {
    sourcePath: '/logs/report.jsonl',
    requestKey: `req_${String(hour)}`,
    sessionId: 'report',
    subAgentId: null,
    at: at(hour),
    model: 'claude-sonnet-4-5',
    inputTokens: 100,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    outputTokens: 10,
  };
}

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await db
    .insert(session)
    .values([
      { id: 'report', project: PROJECT, title: 'Report a bug', lastAt: at(3) },
    ]);
  await db.insert(apiCall).values([call(1), call(2)]);
  await db.insert(closingLine).values([
    {
      sourcePath: '/logs/report.jsonl',
      recordUuid: 'line_1',
      sessionId: 'report',
      at: at(2),
      position: 1,
      line: 'Work item: #12 (bug-reporter)',
    },
  ]);
});

afterAll(async () => {
  await close();
});

describe('bug skill markers with the default rules', () => {
  it('counts a session closing with a bug-reporter marker under bug-reporter', async () => {
    const roles = await listRoles(db, query, DEFAULT_CONFIG);
    expect(roles.roles.map((row) => [row.role, row.apiCalls])).toEqual([
      ['bug-reporter', 2],
    ]);
    const features = await listFeatures(db, query, DEFAULT_CONFIG);
    expect(features.rows.map((row) => [row.number, row.apiCalls])).toEqual([
      [12, 2],
    ]);
  });
});
