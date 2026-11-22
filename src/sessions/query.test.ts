import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { usageOverview } from '../overview/query.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { NOW, ago, options, seedSessions } from '../test/sessions.ts';
import { listSessions } from './query.ts';
import type { SessionListQuery } from './types.ts';

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await seedSessions(db);
});

afterAll(async () => {
  await close();
});

const all: SessionListQuery = { period: 'all', timeZone: 'UTC', limit: 50 };

describe('listSessions', () => {
  it('lists main sessions by last activity, a sub-agent record counting as activity', async () => {
    const list = await listSessions(db, all, options);
    expect(list.sessions.map((row) => row.id)).toEqual([
      'waiting-1',
      'agent-busy',
      'working-1',
      'edge-inactive',
      'old-ended',
    ]);
    expect(list.total).toBe(5);
    const busy = list.sessions[1];
    expect(busy?.firstAt).toBe(ago(90).toISOString());
    expect(busy?.lastAt).toBe(ago(5).toISOString());
  });

  it('applies the state rule at the threshold edges', async () => {
    const { sessions, counts } = await listSessions(db, all, options);
    const states = Object.fromEntries(
      sessions.map((row) => [row.id, row.state]),
    );
    expect(states).toEqual({
      'working-1': 'working',
      'waiting-1': 'waiting',
      'edge-inactive': 'inactive',
      'old-ended': 'inactive',
      'agent-busy': 'working',
    });
    expect(counts).toEqual({ working: 2, waiting: 1, inactive: 2 });
    const shorter = await listSessions(db, all, {
      inactiveAfterMinutes: 1,
      now: NOW,
    });
    expect(shorter.counts).toEqual({ working: 0, waiting: 0, inactive: 5 });
  });

  it('sums the tokens and cost of the whole session, sub-agents included', async () => {
    const { sessions } = await listSessions(db, all, options);
    const byId = new Map(sessions.map((row) => [row.id, row]));
    expect(byId.get('working-1')).toMatchObject({
      title: 'Build the thing',
      project: '/work/app',
      gitBranches: ['main', 'feat/x'],
      tokens: 1_000_020,
      costUsd: 4,
    });
    expect(byId.get('agent-busy')).toMatchObject({
      project: 'unassigned',
      gitBranches: [],
      tokens: 1_100_010,
    });
    expect(byId.get('agent-busy')?.costUsd).toBeCloseTo(1.1);
    expect(byId.get('old-ended')?.costUsd).toBeNull();
    expect(byId.get('waiting-1')).toMatchObject({ tokens: 0, costUsd: 0 });
  });

  it('filters by project, state and period, counting states before the state filter', async () => {
    const app = await listSessions(
      db,
      { ...all, project: '/work/app' },
      options,
    );
    expect(app.sessions.map((row) => row.id)).toEqual([
      'waiting-1',
      'working-1',
    ]);
    expect(app.counts).toEqual({ working: 1, waiting: 1, inactive: 0 });
    const inactive = await listSessions(
      db,
      { ...all, state: 'inactive' },
      options,
    );
    expect(inactive.sessions.map((row) => row.id)).toEqual([
      'edge-inactive',
      'old-ended',
    ]);
    expect(inactive.total).toBe(2);
    expect(inactive.counts).toEqual({ working: 2, waiting: 1, inactive: 2 });
    const week = await listSessions(db, { ...all, period: '7d' }, options);
    expect(week.sessions.map((row) => row.id)).toEqual([
      'waiting-1',
      'agent-busy',
      'working-1',
      'edge-inactive',
    ]);
    expect(week.projects).toEqual([
      { project: '/work/app', name: 'app' },
      { project: '/work/lib', name: 'lib' },
      { project: 'unassigned', name: 'unassigned' },
    ]);
    const none = await listSessions(
      db,
      { ...all, project: '/work/lib', state: 'waiting' },
      options,
    );
    expect(none).toMatchObject({ sessions: [], total: 0 });
  });

  it('adds up to the overview of the same project over all time', async () => {
    for (const project of ['/work/app', '/work/lib', 'unassigned']) {
      const query = { ...all, project, now: NOW };
      const [{ sessions }, overview] = await Promise.all([
        listSessions(db, query, options),
        usageOverview(db, query),
      ]);
      const { tokens } = overview.totals;
      expect(sessions.reduce((sum, row) => sum + row.tokens, 0)).toBe(
        tokens.input + tokens.cacheWrite + tokens.cacheRead + tokens.output,
      );
      expect(
        sessions.reduce((sum, row) => sum + (row.costUsd ?? 0), 0),
      ).toBeCloseTo(overview.totals.costUsd, 9);
      expect(sessions.filter((row) => row.tokens > 0)).toHaveLength(
        overview.totals.sessions,
      );
    }
  });

  it('pages by the limit', async () => {
    const first = await listSessions(db, { ...all, limit: 2 }, options);
    expect(first.sessions.map((row) => row.id)).toEqual([
      'waiting-1',
      'agent-busy',
    ]);
    expect(first.total).toBe(5);
  });
});
