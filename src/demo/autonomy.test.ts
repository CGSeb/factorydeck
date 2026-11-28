import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { giveDemoTokens } from './projects.ts';
import { fakeCollection } from './fake-git-host-token.ts';
import { collect } from '../git-host/collect.ts';
import { hasFactory } from '../ingest/factory.ts';
import { ingest } from '../ingest/ingest.ts';
import { autonomyStats } from '../stats/autonomy.ts';
import { bugStats } from '../stats/bugs.ts';
import type { AutonomyBucket } from '../stats/types.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { sessionsFolder } from '../test/session-logs.ts';
import { AUTONOMY_MERGED, helpKind } from './autonomy.ts';
import { writeDemoSessions } from './sessions.ts';

const NOW = new Date('2026-03-12T15:30:00Z');

let db: Database;
let close: () => Promise<void>;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
  const folder = await sessionsFolder();
  const projects = await sessionsFolder();
  await writeDemoSessions(folder, NOW, projects);
  await ingest(db, folder);
  await giveDemoTokens(db, projects);
  await collect(db, { ...(await fakeCollection()), hasFactory });
});

afterEach(async () => {
  await close();
});

function share(weeks: readonly AutonomyBucket[]): number {
  const merged = weeks.reduce((sum, week) => sum + week.merged, 0);
  const alone = weeks.reduce((sum, week) => sum + week.mergedWithoutPerson, 0);
  return alone / merged;
}

describe('demo autonomy', () => {
  it('helps fewer issues as the weeks go by, with every kind of help', () => {
    const kinds = Array.from({ length: AUTONOMY_MERGED }, (_, index) =>
      helpKind(index),
    );
    expect(new Set(kinds)).toEqual(
      new Set(['none', 'spec', 'below', 'gates', 'spec-below']),
    );
    const helped = (from: number) =>
      kinds.slice(from, from + 15).filter((kind) => kind !== 'none').length;
    expect([helped(0), helped(15), helped(30), helped(45)]).toEqual([
      12, 9, 6, 3,
    ]);
  });

  it('spreads merged issues over 12 weeks, every reason, and questions still waiting', async () => {
    const autonomy = await autonomyStats(
      db,
      { period: 'all', timeZone: 'UTC', now: NOW },
      hasFactory,
    );
    expect(autonomy.current.merged).toBeGreaterThanOrEqual(AUTONOMY_MERGED);
    expect(autonomy.buckets.every((week) => week.merged > 0)).toBe(true);
    expect(share(autonomy.buckets.slice(6))).toBeGreaterThan(
      share(autonomy.buckets.slice(0, 6)),
    );
    const { total, roundsSum, roundsCount, ...rows } = autonomy.reasons;
    for (const count of Object.values(rows)) {
      expect(count).toBeGreaterThan(0);
    }
    expect(Object.values(rows).reduce((sum, count) => sum + count, 0)).toBe(
      total,
    );
    expect(roundsCount).toBeGreaterThan(0);
    expect(roundsSum).toBeGreaterThan(roundsCount);
    expect(autonomy.waitingNow).toBe(3);
    expect(autonomy.current.stopWaitsMs.length).toBeGreaterThan(5);
  });

  it('answers at least 5 stops in the last 7 days', async () => {
    const week = await autonomyStats(
      db,
      { period: '7d', timeZone: 'UTC', now: NOW },
      hasFactory,
    );
    expect(week.current.stopWaitsMs.length).toBeGreaterThanOrEqual(5);
  });

  it('merges at least 5 issues on one of the last 7 days and 3 in one hour of today', async () => {
    const stats = (period: '7d' | 'today') =>
      autonomyStats(db, { period, timeZone: 'UTC', now: NOW }, hasFactory);
    const [week, today] = await Promise.all([stats('7d'), stats('today')]);
    expect(week.unit).toBe('day');
    expect(
      Math.max(...week.buckets.map((bucket) => bucket.merged)),
    ).toBeGreaterThanOrEqual(5);
    expect(today.unit).toBe('hour');
    const hour = today.buckets.find(
      (bucket) => bucket.start === '2026-03-12T15:00',
    );
    expect(hour?.merged).toBeGreaterThanOrEqual(3);
    expect(hour?.mergedWithoutPerson).toBeLessThan(hour?.merged ?? 0);
  });

  it('merges at least 5 bugs in the last 30 days, and a reopened bug over all time', async () => {
    const stats = (period: '30d' | 'all') =>
      bugStats(db, { period, timeZone: 'UTC', now: NOW }, hasFactory);
    const [month, all] = await Promise.all([stats('30d'), stats('all')]);
    expect(month.bugTickets).toBe(true);
    expect(month.current.bugs).toBeGreaterThanOrEqual(5);
    expect(month.current.merged).toBeGreaterThan(month.current.bugs);
    expect(new Set(month.current.fixMs).size).toBeGreaterThan(1);
    expect(all.current.reopened).toBeGreaterThan(0);
  });
});
