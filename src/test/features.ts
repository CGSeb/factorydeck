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
import type { SerenityReport } from '../git-host/types.ts';

export const NOW = new Date('2026-03-12T15:30:00Z');
const RECENT = new Date('2026-03-12T10:00:00Z');
const OLD = new Date('2026-01-05T09:00:00Z');
export const APP = '/work/app';
export const LIB = '/work/lib';
const SONNET = 'claude-sonnet-4-5';
const UNKNOWN = 'mystery-model';
export const state = { inactiveAfterMinutes: 30, now: NOW };
export const week: FeatureQuery = { period: '7d', timeZone: 'UTC', now: NOW };
export const allTime: FeatureQuery = {
  period: 'all',
  timeZone: 'UTC',
  now: NOW,
};

let request = 0;

function call(
  sessionId: string,
  input: number,
  {
    subAgentId = null,
    at = RECENT,
    model = SONNET,
  }: { subAgentId?: string | null; at?: Date; model?: string } = {},
) {
  request += 1;
  return {
    sourcePath: `/logs/${sessionId}.jsonl`,
    requestKey: `req_${String(request)}`,
    sessionId,
    subAgentId,
    at,
    model,
    inputTokens: input,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    outputTokens: 0,
  };
}

function agent(
  sessionId: string,
  id: string,
  agentType: string,
  description: string,
) {
  return { sessionId, id, agentType, description, firstAt: RECENT };
}

function report(score: number): SerenityReport {
  return {
    score,
    threshold: 80,
    rounds: 2,
    gatesPassed: true,
    at: RECENT.toISOString(),
  };
}

function issue(number: number, issueState: string) {
  return {
    project: APP,
    number,
    title: `Issue ${String(number)}`,
    state: issueState,
    labels: [],
    url: `https://git.example/app/issues/${String(number)}`,
    createdAt: OLD,
    updatedAt: RECENT,
  };
}

function mergedRequest(number: number, closes: number, score: number) {
  return {
    project: APP,
    number,
    title: `Request ${String(number)}`,
    state: 'merged',
    draft: false,
    headBranch: `feat/${String(closes)}`,
    url: `https://git.example/app/pull/${String(number)}`,
    createdAt: OLD,
    mergedAt: RECENT,
    updatedAt: RECENT,
    closes: [closes],
    checks: 'passing',
    report: report(score),
  };
}

export async function seedFeatures(db: Database): Promise<void> {
  await db.insert(session).values([
    { id: 's1', project: APP, title: 'Build queue', lastAt: RECENT },
    { id: 's2', project: APP, title: 'Fix #9 export', lastAt: RECENT },
    { id: 's3', project: APP, title: 'Chat', lastAt: RECENT },
    { id: 's4', project: LIB, title: 'Lib work', lastAt: RECENT },
  ]);
  await db
    .insert(subAgent)
    .values([
      agent('s1', 'a1', 'builder', 'Build #7'),
      agent('s1', 'a2', 'reviewer', 'Review #8'),
      agent('s1', 'a3', 'Explore', 'Search code'),
      agent('s2', 'b1', 'builder', 'Build #7'),
      agent('s2', 'b2', 'reviewer', 'Check #99'),
      agent('s3', 'c1', 'Explore', 'Search docs'),
      agent('s4', 'd1', 'builder', 'Build #7'),
      agent('s4', 'd2', 'builder', 'Build #3'),
    ]);
  await db
    .insert(apiCall)
    .values([
      call('s1', 1_000_000),
      call('s1', 100_000, { model: UNKNOWN }),
      call('s1', 1_000_000, { at: OLD }),
      call('s1', 3_000_000, { subAgentId: 'a1' }),
      call('s1', 1_000_000, { subAgentId: 'a2' }),
      call('s1', 2_000_000, { subAgentId: 'a2', at: OLD }),
      call('s1', 500_000, { subAgentId: 'a3' }),
      call('s2', 400_000),
      call('s2', 200_000, { subAgentId: 'b1' }),
      call('s2', 100_000, { subAgentId: 'b2' }),
      call('s3', 300_000),
      call('s3', 100_000, { subAgentId: 'c1' }),
      call('s4', 200_000),
      call('s4', 600_000, { subAgentId: 'd1' }),
      call('s4', 100_000, { subAgentId: 'd2', at: OLD }),
    ]);
  await seedGitHost(db);
}

async function seedGitHost(db: Database): Promise<void> {
  await db.insert(gitHostProject).values({
    project: APP,
    gitHost: 'github',
    repository: 'example-org/example-app',
    syncedFrom: OLD,
    autoMerge: true,
  });
  await db.insert(gitHostIssue).values([
    issue(7, 'closed'),
    {
      ...issue(8, 'closed'),
      needsSpec: [
        { added: true, at: OLD.toISOString() },
        { added: false, at: RECENT.toISOString() },
      ],
    },
    issue(9, 'open'),
    issue(10, 'open'),
  ]);
  await db.insert(gitHostRequest).values([
    mergedRequest(101, 7, 90),
    {
      ...mergedRequest(102, 8, 60),
      reports: [{ ...report(60), at: OLD.toISOString() }, report(60)],
    },
  ]);
}
