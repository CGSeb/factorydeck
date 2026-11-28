import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import {
  gitHostIssue,
  gitHostProject,
  gitHostRequest,
  session,
  subAgent,
} from '../db/schema.ts';
import { listSessions, sessionDetail } from '../sessions/query.ts';
import { createTestDatabase, testRemote } from '../test/postgres.ts';

const NOW = new Date('2026-03-12T12:00:00Z');
const AT = new Date('2026-03-12T11:00:00Z');
const options = { inactiveAfterMinutes: 30, now: NOW };
const COLLECTED = '/work/collected';
const WAITING = '/work/waiting';

let db: Database;
let close: () => Promise<void>;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
  await db.insert(session).values([
    { id: 'found', project: COLLECTED, title: 'Build #52', lastAt: AT },
    { id: 'missing', project: COLLECTED, title: 'Build #53', lastAt: AT },
    { id: 'early', project: WAITING, title: 'Build #52', lastAt: AT },
    { id: 'none', project: COLLECTED, title: 'Explore', lastAt: AT },
  ]);
  await db.insert(subAgent).values([
    { sessionId: 'found', id: 'a', description: 'Worker for #53', firstAt: AT },
    { sessionId: 'found', id: 'b', description: 'Review', firstAt: AT },
  ]);
  await db.insert(gitHostProject).values([
    {
      remote: testRemote(COLLECTED),
      gitHost: 'gitlab',
      repository: 'g/p',
      syncedFrom: AT,
    },
    { remote: testRemote(WAITING), gitHost: 'github', error: 'gh not found' },
  ]);
  await db.insert(gitHostIssue).values({
    remote: testRemote(COLLECTED),
    number: 52,
    title: 'Export button',
    state: 'closed',
    labels: [
      { name: 'spec', color: '#1d76db' },
      { name: 'Backend', color: null },
    ],
    url: 'https://gitlab.example/g/p/-/issues/52',
    createdAt: AT,
    updatedAt: AT,
  });
  await db.insert(gitHostRequest).values(
    [11, 12, 13].map((number) => ({
      remote: testRemote(COLLECTED),
      number,
      title: `Request ${String(number)}`,
      state: number === 11 ? 'merged' : 'open',
      draft: number === 13,
      headBranch: 'feat/52',
      url: `https://gitlab.example/g/p/-/merge_requests/${String(number)}`,
      createdAt: new Date(AT.getTime() + number * 60_000),
      updatedAt: AT,
      closes: number === 12 ? [51] : [52],
      checks: 'passing',
    })),
  );
});

afterEach(async () => {
  await close();
});

describe('work item lookup', () => {
  it('marks each listed session found, not found or not collected yet', async () => {
    const list = await listSessions(
      db,
      { period: 'all', timeZone: 'UTC', limit: 50 },
      options,
    );
    const byId = Object.fromEntries(
      list.sessions.map((row) => [row.id, row.issue]),
    );
    expect(byId).toEqual({
      found: {
        status: 'found',
        title: 'Export button',
        url: 'https://gitlab.example/g/p/-/issues/52',
      },
      missing: { status: 'not-found' },
      early: { status: 'not-collected' },
      none: null,
    });
  });

  it('gives the issue of a session with its sorted labels and the requests that close it, newest first', async () => {
    const detail = await sessionDetail(db, 'found', options);
    expect(detail?.issueDetail).toEqual({
      gitHost: 'gitlab',
      number: 52,
      title: 'Export button',
      url: 'https://gitlab.example/g/p/-/issues/52',
      state: 'closed',
      labels: [
        { name: 'Backend', color: null },
        { name: 'spec', color: '#1d76db' },
      ],
      requests: [
        expect.objectContaining({ number: 13, draft: true, state: 'open' }),
        expect.objectContaining({ number: 11, state: 'merged' }),
      ],
      outcome: { stage: 'merged', report: null, reworked: true },
      milestones: [],
    });
    expect(detail?.subAgents.map((agent) => agent.issue)).toEqual([
      { status: 'not-found' },
      expect.objectContaining({ status: 'found', title: 'Export button' }),
    ]);
  });

  it('gives no issue detail when the issue is not found or not collected yet', async () => {
    expect(
      (await sessionDetail(db, 'missing', options))?.issueDetail,
    ).toBeNull();
    const early = await sessionDetail(db, 'early', options);
    expect(early?.issue).toEqual({ status: 'not-collected' });
    expect(early?.issueDetail).toBeNull();
  });
});
