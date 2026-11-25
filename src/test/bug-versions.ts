import type { Database } from '../db/client.ts';
import {
  apiCall,
  gitHostIssue,
  gitHostProject,
  gitHostRequest,
  session,
  subAgent,
} from '../db/schema.ts';
import type { FeatureQuery } from '../features/types.ts';
import type { SerenityReport, StateEvent } from '../git-host/types.ts';

export const APP = '/work/app';
export const NOW = new Date('2026-03-12T15:30:00Z');
export const CREATED = '2026-03-01T10:00:00.000Z';
export const allTime: FeatureQuery = {
  period: 'all',
  timeZone: 'UTC',
  now: NOW,
};

export function day(date: number, hour = 10): string {
  return new Date(Date.UTC(2026, 2, date, hour)).toISOString();
}

export function closedOn(at: string): StateEvent {
  return { state: 'closed', at };
}

export function reopenedOn(at: string): StateEvent {
  return { state: 'reopened', at };
}

export function report(
  score: number,
  rootCause: string,
  at: string,
): SerenityReport {
  return {
    score,
    threshold: 80,
    rounds: 1,
    gatesPassed: true,
    at,
    rootCause,
    reproduced: 'failed-on-main',
  };
}

export function bug(
  number: number,
  stateEvents: StateEvent[],
  { state = 'open', labels = [] }: { state?: string; labels?: string[] } = {},
): typeof gitHostIssue.$inferInsert {
  const closedAt = state === 'closed' ? stateEvents.at(-1)?.at : undefined;
  return {
    project: APP,
    number,
    title: `Issue ${String(number)}`,
    state,
    labels: ['bug', ...labels].map((name) => ({ name, color: null })),
    url: `https://git.example/app/issues/${String(number)}`,
    createdAt: new Date(CREATED),
    closedAt: closedAt === undefined ? null : new Date(closedAt),
    updatedAt: new Date(day(12)),
    reopened: stateEvents.some((event) => event.state === 'reopened'),
    stateEvents,
  };
}

export function request(
  number: number,
  closes: number,
  {
    createdAt,
    mergedAt = null,
    score = 85,
    rootCause = `cause ${String(number)}`,
  }: {
    createdAt: string;
    mergedAt?: string | null;
    score?: number;
    rootCause?: string;
  },
): typeof gitHostRequest.$inferInsert {
  const at = mergedAt ?? createdAt;
  const found = report(score, rootCause, at);
  return {
    project: APP,
    number,
    title: `Request ${String(number)}`,
    state: mergedAt === null ? 'open' : 'merged',
    draft: false,
    headBranch: `fix/${String(closes)}`,
    url: `https://git.example/app/pull/${String(number)}`,
    createdAt: new Date(createdAt),
    mergedAt: mergedAt === null ? null : new Date(mergedAt),
    updatedAt: new Date(at),
    closes: [closes],
    checks: 'passing',
    report: found,
    reports: [found],
  };
}

async function seedBugProject(db: Database): Promise<void> {
  await db.insert(gitHostProject).values({
    project: APP,
    gitHost: 'github',
    repository: 'example-org/example-app',
    syncedFrom: NOW,
    autoMerge: true,
    bugLabel: 'bug',
    stageLabels: {
      ready: 'agent:ready',
      working: 'agent:working',
      needs_spec: 'agent:needs-spec',
      review: 'agent:review',
      blocked: 'agent:blocked',
    },
  });
}

export async function seedBugVersions(db: Database): Promise<void> {
  await seedBugProject(db);
  await db.insert(gitHostIssue).values([
    bug(10, [closedOn(day(3)), reopenedOn(day(5)), closedOn(day(7))], {
      state: 'closed',
    }),
    bug(
      11,
      [
        closedOn(day(2)),
        reopenedOn(day(3)),
        closedOn(day(4)),
        reopenedOn(day(5)),
      ],
      { labels: ['agent:working'] },
    ),
    bug(12, [closedOn(day(2)), reopenedOn(day(3)), closedOn(day(4))], {
      state: 'closed',
    }),
    bug(13, [closedOn(day(3)), reopenedOn(day(4))]),
    bug(14, [closedOn(day(11)), reopenedOn(day(12, 8))]),
    bug(15, [], { labels: ['agent:ready'] }),
  ]);
  await db.insert(gitHostRequest).values([
    request(20, 10, {
      createdAt: day(2),
      mergedAt: day(3),
      score: 90,
      rootCause: 'the first guess',
    }),
    request(21, 10, {
      createdAt: day(6),
      mergedAt: day(7),
      score: 82,
      rootCause: 'the real cause',
    }),
    request(22, 11, { createdAt: day(4, 12), score: 70 }),
    request(23, 11, { createdAt: day(6), score: 88, rootCause: 'third try' }),
    request(24, 12, {
      createdAt: day(1, 12),
      mergedAt: day(4),
      rootCause: 'merged late',
    }),
    request(25, 13, { createdAt: day(2), mergedAt: day(3, 11) }),
    request(26, 14, { createdAt: day(10), mergedAt: day(11) }),
  ]);
}

let requestKey = 0;

export function call(
  sessionId: string,
  input: number,
  at: string,
  subAgentId: string | null = null,
): typeof apiCall.$inferInsert {
  requestKey += 1;
  return {
    sourcePath: `/logs/${sessionId}.jsonl`,
    requestKey: `req_${String(requestKey)}`,
    sessionId,
    subAgentId,
    at: new Date(at),
    model: 'claude-sonnet-4-5',
    inputTokens: input,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    outputTokens: 0,
  };
}

export async function seedBugCalls(db: Database): Promise<void> {
  await db
    .insert(session)
    .values([{ id: 's1', project: APP, title: 'Fix the queue', lastAt: NOW }]);
  await db.insert(subAgent).values([
    {
      sessionId: 's1',
      id: 'a1',
      agentType: 'debugger',
      description: 'Fix #10',
      firstAt: new Date(day(2)),
    },
  ]);
  await db
    .insert(apiCall)
    .values([
      call('s1', 1_000, day(2, 12), 'a1'),
      call('s1', 300, day(2, 12)),
      call('s1', 500, day(6), 'a1'),
      call('s1', 200, day(6)),
      call('s1', 50, day(8), 'a1'),
    ]);
}
