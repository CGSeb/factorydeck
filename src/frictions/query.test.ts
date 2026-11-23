import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import { API, APP, LONG_HOOK, NOW, seedFrictions } from '../test/frictions.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { type FrictionQuery, frictionStats } from './query.ts';

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await seedFrictions(db);
});

afterAll(async () => {
  await close();
});

function stats(query: Partial<FrictionQuery> = {}) {
  return frictionStats(
    db,
    { period: '7d', timeZone: 'UTC', project: APP, now: NOW, ...query },
    DEFAULT_CONFIG,
  );
}

describe('frictionStats', () => {
  it('counts every kind of the period and project, with its API calls', async () => {
    const result = await stats();
    expect(result.kind).toBeNull();
    expect(result.counts).toEqual({
      'tool-error': 22,
      'stop-blocked': 4,
      compaction: 6,
    });
    expect(result.frictions).toBe(32);
    expect(result.apiCalls).toBe(100);
  });

  it('counts the frictions and calls of every project with All projects', async () => {
    const result = await stats({ project: undefined });
    expect(result.frictions).toBe(33);
    expect(result.apiCalls).toBe(110);
  });

  it('keeps the frictions before the period out of its figures', async () => {
    const all = await stats({ period: 'all' });
    expect(all.counts['tool-error']).toBe(23);
    expect(all.apiCalls).toBe(130);
  });

  it('gives 12 weeks of frictions of the kind and API calls', async () => {
    const result = await stats({ kind: 'stop-blocked' });
    expect(result.weeks).toHaveLength(12);
    expect(result.weeks.at(-1)).toEqual({
      start: '2026-03-16',
      frictions: 4,
      apiCalls: 100,
    });
    expect(result.weeks.at(-3)).toEqual({
      start: '2026-03-02',
      frictions: 0,
      apiCalls: 0,
    });
    const all = await stats();
    expect(all.weeks.at(-4)).toEqual({
      start: '2026-02-23',
      frictions: 1,
      apiCalls: 30,
    });
    expect(all.weeks.at(-2)).toEqual({
      start: '2026-03-09',
      frictions: 4,
      apiCalls: 0,
    });
  });

  it('sorts the categories by errors, ties in the category order', async () => {
    const result = await stats({ kind: 'tool-error' });
    expect(result.categories).toEqual([
      { category: 'command-failed', errors: 16 },
      { category: 'permission-denied', errors: 2 },
      { category: 'other', errors: 2 },
      { category: 'hook-blocked', errors: 1 },
      { category: 'tool-misuse', errors: 1 },
    ]);
  });

  it('sorts the tools by errors then name, with their main category and threads', async () => {
    const result = await stats();
    expect(result.tools).toEqual([
      { tool: 'Bash', errors: 18, mainCategory: 'command-failed', threads: 3 },
      { tool: 'Edit', errors: 2, mainCategory: 'hook-blocked', threads: 1 },
      { tool: 'Write', errors: 2, mainCategory: 'other', threads: 1 },
    ]);
  });

  it('groups the failed commands by program with every exit code', async () => {
    const result = await stats();
    expect(result.commands).toEqual([
      {
        program: 'pnpm',
        failures: 9,
        exitCodes: [1, 2, 4, 5, 7, 9, 127],
        distinctCommands: 6,
      },
      { program: 'curl', failures: 3, exitCodes: [6], distinctCommands: 1 },
      { program: 'git', failures: 3, exitCodes: [1], distinctCommands: 1 },
      { program: null, failures: 1, exitCodes: [], distinctCommands: 0 },
    ]);
  });

  it('lists a command failing 3 times in one thread, not 2, with the role and work item of its thread at the last failure', async () => {
    const result = await stats();
    expect(result.repeated).toEqual([
      {
        program: 'git',
        failures: 3,
        role: 'reviewer',
        project: APP,
        workItem: 22,
        sessionId: 'app-2',
        sessionTitle: '',
        lastAt: '2026-03-17T15:00:00.000Z',
      },
      {
        program: 'curl',
        failures: 3,
        role: 'builder',
        project: APP,
        workItem: 21,
        sessionId: 'app-2',
        sessionTitle: '',
        lastAt: '2026-03-17T09:45:00.000Z',
      },
      {
        program: 'pnpm',
        failures: 3,
        role: 'builder',
        project: APP,
        workItem: 9,
        sessionId: 'app-1',
        sessionTitle: 'Fix login',
        lastAt: '2026-03-17T08:03:00.000Z',
      },
    ]);
  });

  it('keeps a hook command whole, with its blocks, sessions and last time', async () => {
    const result = await stats({ kind: 'stop-blocked' });
    expect(result.hooks).toEqual([
      {
        command: LONG_HOOK,
        blocks: 2,
        sessions: 2,
        lastAt: '2026-03-17T11:00:00.000Z',
      },
      {
        command: 'make check',
        blocks: 2,
        sessions: 1,
        lastAt: '2026-03-16T12:00:00.000Z',
      },
    ]);
    expect(result.frictions).toBe(4);
    expect(result.categories).toEqual([]);
    expect(result.tools).toEqual([]);
    expect(result.commands).toEqual([]);
    expect(result.repeated).toEqual([]);
    expect(result.compactions).toEqual([]);
  });

  it('gives the compactions by trigger with the median tokens before', async () => {
    const result = await stats({ kind: 'compaction' });
    expect(result.compactions).toEqual([
      { trigger: 'auto', compactions: 4, medianPreTokens: 306_000, threads: 1 },
      { trigger: 'manual', compactions: 1, medianPreTokens: null, threads: 1 },
      { trigger: 'other', compactions: 1, medianPreTokens: null, threads: 1 },
    ]);
    expect(result.hooks).toEqual([]);
    expect(result.tools).toEqual([]);
  });

  it('counts the frictions of another project apart', async () => {
    const result = await stats({ project: API });
    expect(result.counts).toEqual({
      'tool-error': 1,
      'stop-blocked': 0,
      compaction: 0,
    });
    expect(result.apiCalls).toBe(10);
    expect(result.repeated).toEqual([]);
  });
});
