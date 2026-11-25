import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { gitHostIssue } from '../db/schema.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import {
  CREATED,
  allTime,
  bug,
  day,
  seedBugCalls,
  seedBugVersions,
} from '../test/bug-versions.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { bugCounts, listBugs } from './query.ts';
import type { BugList, BugRow } from './types.ts';

let db: Database;
let close: () => Promise<void>;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
});

afterEach(async () => {
  await close();
});

function rowsOf(list: BugList): BugRow[] {
  return [...list.groups.open, ...list.groups.fixing, ...list.groups.fixed];
}

function rowOf(list: BugList, number: number): BugRow | undefined {
  return rowsOf(list).find((row) => row.number === number);
}

describe('listBugs with versions', () => {
  it('shows a bug reopened after a merge and fixed again by its second request', async () => {
    await seedBugVersions(db);
    const list = await listBugs(db, allTime, DEFAULT_CONFIG);
    expect(list.groups.fixed.map((row) => row.number)).toContain(10);
    expect(rowOf(list, 10)).toMatchObject({
      stage: 'merged',
      createdAt: CREATED,
      version: { number: 2, count: 2, startedAt: day(5) },
      mergedAt: day(7),
      fix: { rootCause: 'the real cause', reproduced: 'failed-on-main' },
      score: 82,
      threshold: 80,
    });
  });

  it('puts a bug in its third version in Fixing with the fix of that version only', async () => {
    await seedBugVersions(db);
    const list = await listBugs(db, allTime, DEFAULT_CONFIG);
    expect(list.groups.fixing.map((row) => row.number)).toEqual([11]);
    expect(rowOf(list, 11)).toMatchObject({
      stage: 'working',
      version: { number: 3, count: 3, startedAt: day(5) },
      fix: { rootCause: 'third try' },
      score: 88,
    });
  });

  it('gives a request created in one version and merged in the next to the next one', async () => {
    await seedBugVersions(db);
    const list = await listBugs(db, allTime, DEFAULT_CONFIG);
    expect(rowOf(list, 12)).toMatchObject({
      stage: 'merged',
      version: { number: 2, count: 2, startedAt: day(3) },
      mergedAt: day(4),
      fix: { rootCause: 'merged late' },
    });
  });

  it('keeps a request merged between a close and the next reopen with the version that close ended', async () => {
    await seedBugVersions(db);
    const list = await listBugs(db, allTime, DEFAULT_CONFIG);
    expect(list.groups.open.map((row) => row.number)).toContain(13);
    expect(rowOf(list, 13)).toMatchObject({
      stage: 'open',
      version: { number: 2, count: 2, startedAt: day(4) },
      mergedAt: null,
      fix: null,
      score: null,
      threshold: null,
    });
  });

  it('sorts Open by the start of the current version, longest open first', async () => {
    await seedBugVersions(db);
    await db
      .insert(gitHostIssue)
      .values({ ...bug(16, []), createdAt: new Date(day(3, 12)) });
    const list = await listBugs(db, allTime, DEFAULT_CONFIG);
    expect(list.groups.open.map((row) => row.number)).toEqual([15, 16, 13, 14]);
  });

  it('shows a bug fixed in the period and reopened since only by its current version', async () => {
    await seedBugVersions(db);
    const week = await listBugs(
      db,
      { ...allTime, period: '7d' },
      DEFAULT_CONFIG,
    );
    expect(rowsOf(week).filter((row) => row.number === 14)).toHaveLength(1);
    expect(week.groups.open.map((row) => row.number)).toContain(14);
    expect(week.groups.fixed.map((row) => row.number)).not.toContain(14);
  });

  it('counts each bug once, by its current version, on /bugs and the overview alike', async () => {
    await seedBugVersions(db);
    const list = await listBugs(db, allTime, DEFAULT_CONFIG);
    expect(list.counts).toEqual({ open: 4, fixed: 2, closed: 0 });
    expect((await bugCounts(db, undefined)).counts).toEqual(list.counts);
    expect(rowOf(list, 15)).toMatchObject({
      version: { number: 1, count: 1, startedAt: CREATED },
    });
  });

  it('counts the tokens of the calls inside the current version only, orchestration share included', async () => {
    await seedBugVersions(db);
    await seedBugCalls(db);
    const list = await listBugs(db, allTime, DEFAULT_CONFIG);
    expect(rowOf(list, 10)).toMatchObject({ tokens: 700, lastAt: day(6) });
    expect(rowOf(list, 13)).toMatchObject({ tokens: 0, costUsd: 0 });
  });
});
