import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { ingest } from '../ingest/ingest.ts';
import { usageOverview } from '../overview/query.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { sessionsFolder } from '../test/session-logs.ts';
import { writeDemoSessions } from './sessions.ts';

const NOW = new Date('2026-03-12T15:30:00Z');

let db: Database;
let close: () => Promise<void>;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
  const folder = await sessionsFolder();
  await writeDemoSessions(folder, NOW);
  await ingest(db, folder);
});

afterEach(async () => {
  await close();
});

describe('demo sessions', () => {
  it('cover every case the overview shows', async () => {
    const all = await usageOverview(db, {
      period: 'all',
      timeZone: 'UTC',
      now: NOW,
    });
    expect(all.projects.map((row) => row.project).sort()).toEqual([
      '/demo/example-api',
      '/demo/example-app',
      'unassigned',
    ]);
    expect(all.totals.unknownPriceCalls).toBe(4);
    expect(all.models.map((row) => row.model)).toEqual(
      expect.arrayContaining(['', 'example-model-x', 'claude-haiku-demo']),
    );
    const week = await usageOverview(db, {
      period: '7d',
      timeZone: 'UTC',
      now: NOW,
    });
    const days = week.series.filter(
      (point) => point.opus + point.sonnet + point.haiku + point.other > 0,
    );
    expect(days.length).toBeGreaterThanOrEqual(5);
    expect(days.length).toBeLessThan(7);
    const today = await usageOverview(db, {
      period: 'today',
      timeZone: 'UTC',
      now: NOW,
    });
    expect(today.totals.apiCalls).toBe(3);
  });
});
