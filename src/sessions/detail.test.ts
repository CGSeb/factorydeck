import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { ago, options, seedSessions } from '../test/sessions.ts';
import { listSessions, sessionDetail } from './query.ts';

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await seedSessions(db);
});

afterAll(async () => {
  await close();
});

describe('sessionDetail', () => {
  it('gives the session with its four token kinds and its sub-agents in start order', async () => {
    const detail = await sessionDetail(db, 'agent-busy', options);
    expect(detail).toMatchObject({
      id: 'agent-busy',
      state: 'working',
      cwd: null,
      tokens: {
        input: 1_000_001,
        cacheWrite: 2,
        cacheRead: 3,
        output: 100_004,
      },
    });
    expect(detail?.costUsd).toBeCloseTo(1.1);
    expect(detail?.skills).toMatchObject([{ skill: null, tokens: 1_100_010 }]);
    expect(detail?.skills[0]?.costUsd).toBeCloseTo(1.1, 10);
    expect(detail?.subAgents).toEqual([
      {
        id: 'a-first',
        agentType: '',
        role: 'unassigned',
        workItem: null,
        issue: null,
        description: '',
        model: '',
        firstAt: ago(85).toISOString(),
        lastAt: ago(75).toISOString(),
        tokens: 10,
        tokenCounts: { input: 1, cacheWrite: 2, cacheRead: 3, output: 4 },
        costUsd: null,
      },
      {
        id: 'b-second',
        agentType: 'Explore',
        role: 'Explore',
        workItem: null,
        issue: null,
        description: 'Look around',
        model: 'claude-haiku-9',
        firstAt: ago(70).toISOString(),
        lastAt: ago(5).toISOString(),
        tokens: 1_000_000,
        tokenCounts: { input: 1e6, cacheWrite: 0, cacheRead: 0, output: 0 },
        costUsd: 0.1,
      },
    ]);
  });

  it('gives a session without sub-agents, with the figures of its row', async () => {
    const detail = await sessionDetail(db, 'working-1', options);
    expect(detail).toMatchObject({
      cwd: '/work/app',
      gitBranches: ['main', 'feat/x'],
      subAgents: [],
      costUsd: 4,
    });
    expect(detail?.tokens).toEqual({
      input: 1_000_005,
      cacheWrite: 5,
      cacheRead: 5,
      output: 5,
    });
  });

  it('gives the project options of the project select', async () => {
    const detail = await sessionDetail(db, 'working-1', options);
    const list = await listSessions(
      db,
      { period: 'all', timeZone: 'UTC', limit: 1 },
      options,
    );
    expect(detail?.projects).toEqual(list.projects);
    expect(detail?.projects.map(({ project }) => project)).toContain(
      '/work/app',
    );
  });

  it('gives nothing for an unknown session', async () => {
    await expect(sessionDetail(db, 'nope', options)).resolves.toBeUndefined();
  });
});
