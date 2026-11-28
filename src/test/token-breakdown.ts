import type { Database } from '../db/client.ts';
import {
  apiCall,
  gitHostIssue,
  gitHostProject,
  gitHostRequest,
  session,
  skillLaunch,
  subAgent,
} from '../db/schema.ts';
import type { FeatureQuery } from '../features/types.ts';
import type { TokenCounts } from '../overview/types.ts';
import { testRemote } from './postgres.ts';

export const NOW = new Date('2026-03-12T15:30:00Z');
export const APP = '/work/app';
const SONNET = 'claude-sonnet-4-5';
export const week: FeatureQuery = { period: '7d', timeZone: 'UTC', now: NOW };
export const today: FeatureQuery = {
  period: 'today',
  timeZone: 'UTC',
  now: NOW,
};
export const state = { inactiveAfterMinutes: 30, now: NOW };

let request = 0;

function call(
  sessionId: string,
  at: string,
  [input, cacheWrite, cacheRead, output]: [number, number, number, number],
  {
    subAgentId = null,
    model = SONNET,
  }: { subAgentId?: string | null; model?: string } = {},
) {
  request += 1;
  return {
    sourcePath: `/logs/${sessionId}.jsonl`,
    requestKey: `req_${String(request)}`,
    sessionId,
    subAgentId,
    at: new Date(at),
    model,
    inputTokens: input,
    cacheWriteTokens: cacheWrite,
    cacheReadTokens: cacheRead,
    outputTokens: output,
  };
}

export function counts(
  input: number,
  cacheWrite: number,
  cacheRead: number,
  output: number,
): TokenCounts {
  return { input, cacheWrite, cacheRead, output };
}

export function sumOf(rows: { tokenCounts: TokenCounts }[]): TokenCounts {
  return rows.reduce(
    (sum, { tokenCounts }) =>
      counts(
        sum.input + tokenCounts.input,
        sum.cacheWrite + tokenCounts.cacheWrite,
        sum.cacheRead + tokenCounts.cacheRead,
        sum.output + tokenCounts.output,
      ),
    counts(0, 0, 0, 0),
  );
}

export async function seedTokenBreakdown(db: Database): Promise<void> {
  const lastAt = new Date('2026-03-12T14:00:00Z');
  await db.insert(session).values([
    { id: 's1', project: APP, title: 'Orchestrate', lastAt },
    { id: 's2', project: APP, title: 'Fix #3', lastAt },
    { id: 's3', project: APP, title: 'Chat', lastAt },
  ]);
  await db.insert(subAgent).values([
    {
      sessionId: 's1',
      id: 'a1',
      agentType: 'builder',
      description: 'Build #1',
    },
    {
      sessionId: 's1',
      id: 'a2',
      agentType: 'builder',
      description: 'Build #2',
    },
  ]);
  await db.insert(apiCall).values([
    call('s1', '2026-01-05T09:00:00Z', [1_000, 0, 0, 0]),
    call('s1', '2026-03-12T10:00:00Z', [1, 2, 3, 4]),
    call('s1', '2026-03-12T09:00:00Z', [100, 0, 0, 200], {
      subAgentId: 'a1',
    }),
    call('s1', '2026-03-12T11:20:00Z', [0, 50, 0, 0], { subAgentId: 'a2' }),
    call('s2', '2026-03-11T08:00:00Z', [5, 0, 0, 5]),
    call('s2', '2026-03-12T14:00:00Z', [10, 20, 30, 40]),
    call('s3', '2026-03-12T12:00:00Z', [7, 1, 1, 3], {
      model: 'mystery-model',
    }),
  ]);
  await db.insert(skillLaunch).values({
    sourcePath: '/logs/s3.jsonl',
    recordUuid: 'launch-1',
    sessionId: 's3',
    at: new Date('2026-03-12T11:59:00Z'),
    skill: 'review',
  });
  await seedOutcome(db);
}

async function seedOutcome(db: Database): Promise<void> {
  await db.insert(gitHostProject).values({
    remote: testRemote(APP),
    gitHost: 'github',
    repository: 'example-org/example-app',
    syncedFrom: new Date('2026-01-01T00:00:00Z'),
    autoMerge: true,
  });
  await db.insert(gitHostIssue).values({
    remote: testRemote(APP),
    number: 1,
    title: 'Issue 1',
    state: 'closed',
    labels: [],
    url: 'https://git.example/app/issues/1',
    createdAt: new Date('2026-03-01T00:00:00Z'),
    updatedAt: NOW,
  });
  await db.insert(gitHostRequest).values({
    remote: testRemote(APP),
    number: 11,
    title: 'Request 11',
    state: 'merged',
    draft: false,
    headBranch: 'feat/1',
    url: 'https://git.example/app/pull/11',
    createdAt: new Date('2026-03-01T00:00:00Z'),
    mergedAt: NOW,
    updatedAt: NOW,
    closes: [1],
    checks: 'passing',
    report: null,
  });
}
