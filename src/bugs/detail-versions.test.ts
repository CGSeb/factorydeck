import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { gitHostIssue, gitHostRequest } from '../db/schema.ts';
import { versionDetailOf } from '../features/query.ts';
import { type FeatureDetail, INVALID_VERSION } from '../features/types.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import {
  APP,
  CREATED,
  NOW,
  allTime,
  bug,
  day,
  request,
  seedBugCalls,
  seedBugVersions,
  seedCallsBetweenVersions,
} from '../test/bug-versions.ts';
import { createTestDatabase } from '../test/postgres.ts';

let db: Database;
let close: () => Promise<void>;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
  await seedBugVersions(db);
});

afterEach(async () => {
  await close();
});

const context = {
  config: DEFAULT_CONFIG,
  state: { inactiveAfterMinutes: 30, now: NOW },
};

async function pageOf(
  number: number,
  version?: number,
  query = allTime,
): Promise<FeatureDetail> {
  const found = await versionDetailOf(
    db,
    { project: APP, number },
    { ...query, version },
    context,
  );
  if (found === undefined || found === INVALID_VERSION) {
    throw new Error(`No page for #${String(number)}`);
  }
  return found;
}

function tokensOf(page: FeatureDetail): number {
  return [...page.roles, ...(page.orchestration ? [page.orchestration] : [])]
    .map((role) => role.tokens)
    .reduce((sum, tokens) => sum + tokens, 0);
}

describe('the page of a bug by version', () => {
  it('opens at the latest version without a version parameter', async () => {
    const page = await pageOf(11);
    expect(page.version).toEqual({
      number: 3,
      count: 3,
      startedAt: day(5),
      endedAt: null,
      reopenedAt: null,
    });
    expect(page.fix).toMatchObject({ rootCause: 'third try' });
    expect(page.detail?.outcome).toMatchObject({
      stage: 'working',
      report: { score: 88 },
    });
    expect(page.detail?.requests.map((request) => request.number)).toEqual([
      23,
    ]);
  });

  it('gives an earlier version its own fix, requests and end', async () => {
    const second = await pageOf(11, 2);
    expect(second.version).toEqual({
      number: 2,
      count: 3,
      startedAt: day(3),
      endedAt: day(4),
      reopenedAt: day(5),
    });
    expect(second.fix).toMatchObject({
      rootCause: 'cause 22',
      request: { number: 22 },
    });
    expect(second.detail?.outcome).toMatchObject({
      stage: 'closed',
      report: { score: 70 },
    });
    expect(second.detail?.requests.map((request) => request.number)).toEqual([
      22,
    ]);
    const first = await pageOf(11, 1);
    expect(first.version).toMatchObject({
      number: 1,
      startedAt: CREATED,
      endedAt: day(2),
      reopenedAt: day(3),
    });
    expect(first.fix).toBeNull();
    expect(first.detail?.outcome).toMatchObject({
      stage: 'closed',
      report: null,
    });
    expect(first.detail?.requests).toEqual([]);
  });

  it('gives the version that a merge fixed its merged stage', async () => {
    const first = await pageOf(10, 1);
    expect(first.detail?.outcome.stage).toBe('merged');
    expect(first.fix).toMatchObject({ rootCause: 'the first guess' });
    const latest = await pageOf(10);
    expect(latest.version?.number).toBe(2);
    expect(latest.fix).toMatchObject({ rootCause: 'the real cause' });
  });

  it('says a version is reworked only when it has more than one request of its own', async () => {
    const reworked = async (number: number, version?: number) =>
      (await pageOf(number, version)).detail?.outcome.reworked;
    expect(await reworked(11, 1)).toBe(false);
    expect(await reworked(11, 2)).toBe(false);
    expect(await reworked(11, 3)).toBe(false);
    await db
      .insert(gitHostRequest)
      .values(request(27, 10, { createdAt: day(6, 12) }));
    expect(await reworked(10, 1)).toBe(false);
    expect(await reworked(10, 2)).toBe(true);
  });

  it('cuts the timeline and the tokens by version, whatever the period', async () => {
    await seedBugCalls(db);
    const first = await pageOf(10, 1);
    const second = await pageOf(10, 2);
    expect(tokensOf(first)).toBe(1_300);
    expect(tokensOf(second)).toBe(750);
    expect(
      first.threads.map((thread) => [thread.firstAt, thread.lastAt]),
    ).toEqual([[day(2, 12), day(2, 12)]]);
    expect(
      second.threads.map((thread) => [thread.firstAt, thread.lastAt]),
    ).toEqual([[day(6), day(8)]]);
    expect(
      first.detail?.milestones.map(
        (milestone) => milestone.kind === 'report' && milestone.request.number,
      ),
    ).toEqual([20]);
    expect(
      second.detail?.milestones.map(
        (milestone) => milestone.kind === 'report' && milestone.request.number,
      ),
    ).toEqual([21]);
    const today = await pageOf(10, 1, { ...allTime, period: 'today' });
    expect(tokensOf(today)).toBe(1_300);
    expect(today.detail?.milestones).toEqual(first.detail?.milestones);
  });

  it('counts the calls, frictions and needs-spec episodes between a close and the next reopen in the version that close ended', async () => {
    await seedCallsBetweenVersions(db);
    const first = await pageOf(30, 1);
    const second = await pageOf(30, 2);
    expect(tokensOf(first) + tokensOf(second)).toBe(1_500);
    expect(tokensOf(first)).toBe(1_000);
    expect(tokensOf(second)).toBe(500);
    expect(first.frictions + second.frictions).toBe(1);
    expect(
      first.detail?.milestones.flatMap((milestone) =>
        milestone.kind === 'needs-spec' ? [milestone.at] : [],
      ),
    ).toEqual([day(3, 13)]);
    expect(first.version).toMatchObject({
      endedAt: day(3),
      reopenedAt: day(4),
    });
  });

  it('counts the calls after the last close of a closed bug in its latest version', async () => {
    await seedCallsBetweenVersions(db, { closedAgain: true });
    const latest = await pageOf(30);
    expect(tokensOf(latest)).toBe(700);
    expect(latest.version).toMatchObject({ endedAt: day(5) });
  });

  it('keeps the report of a request merged after a close on the timeline of the version that close ended', async () => {
    const first = await pageOf(13, 1);
    const second = await pageOf(13, 2);
    const reports = (page: FeatureDetail) =>
      page.detail?.milestones.flatMap((milestone) =>
        milestone.kind === 'report' ? [milestone.request.number] : [],
      );
    expect(first.fix).toMatchObject({ request: { number: 25 } });
    expect(reports(first)).toEqual([25]);
    expect(reports(second)).toEqual([]);
  });

  it('does not know an unknown issue, with or without a version', async () => {
    for (const version of [undefined, 1, 2]) {
      expect(
        await versionDetailOf(
          db,
          { project: APP, number: 404 },
          { ...allTime, version },
          context,
        ),
      ).toBeUndefined();
    }
  });

  it('refuses a version that the bug does not have, and any version of a feature', async () => {
    await db
      .insert(gitHostIssue)
      .values({ ...bug(16, []), labels: [], title: 'A feature' });
    for (const [number, version] of [
      [11, 0],
      [11, 4],
      [15, 2],
      [16, 1],
    ] as const) {
      expect(
        await versionDetailOf(
          db,
          { project: APP, number },
          { ...allTime, version },
          context,
        ),
      ).toBe(INVALID_VERSION);
    }
    expect((await pageOf(16)).version).toBeNull();
    expect((await pageOf(15, 1)).version).toEqual({
      number: 1,
      count: 1,
      startedAt: CREATED,
      endedAt: null,
      reopenedAt: null,
    });
  });
});
