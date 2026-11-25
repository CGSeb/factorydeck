import type { Database } from '../db/client.ts';
import {
  apiCall,
  gitHostIssue,
  gitHostProject,
  gitHostRequest,
  session,
  subAgent,
} from '../db/schema.ts';
import type { IssueKind } from '../git-host/kind.ts';
import type { LabelChange, SerenityReport } from '../git-host/types.ts';
import type { Period } from '../overview/types.ts';
import type { AutonomyQuery } from '../stats/autonomy.ts';

export const APP = '/work/app';
export const PLAIN = '/work/plain';
export const NOW = new Date('2026-03-18T12:00:00Z');
const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export const LABELS = {
  ready: 'agent:ready',
  working: 'agent:working',
  needs_spec: 'agent:needs-spec',
  review: 'agent:review',
  blocked: 'agent:blocked',
};

let requestNumber = 100;
let callNumber = 0;

function report(at: string, score: number): SerenityReport {
  return { score, threshold: 80, rounds: 1, gatesPassed: true, at };
}

interface Merge {
  at: string;
  reports?: SerenityReport[];
}

export interface Seed {
  project?: string;
  number: number;
  labels: string[];
  createdAt: string;
  merges?: Merge[];
  closedAt?: string;
  reopened?: boolean;
  needsSpec?: LabelChange[];
}

export async function seed(
  db: Database,
  {
    project = APP,
    number,
    labels,
    createdAt,
    merges = [],
    closedAt,
    reopened = false,
    needsSpec = [],
  }: Seed,
): Promise<void> {
  const closed = merges.at(-1)?.at ?? closedAt;
  await db.insert(gitHostIssue).values({
    project,
    number,
    title: `Issue ${String(number)}`,
    state: closed === undefined ? 'open' : 'closed',
    labels: labels.map((name) => ({ name, color: null })),
    url: `https://git.example/issues/${String(number)}`,
    createdAt: new Date(createdAt),
    closedAt: closed === undefined ? null : new Date(closed),
    updatedAt: new Date(createdAt),
    reopened,
    needsSpec,
  });
  for (const merge of merges) {
    requestNumber += 1;
    const reports = merge.reports ?? [report(merge.at, 90)];
    await db.insert(gitHostRequest).values({
      project,
      number: requestNumber,
      title: `Request ${String(requestNumber)}`,
      state: 'merged',
      draft: false,
      headBranch: `feat/${String(number)}`,
      url: `https://git.example/pull/${String(requestNumber)}`,
      createdAt: new Date(createdAt),
      mergedAt: new Date(merge.at),
      updatedAt: new Date(merge.at),
      closes: [number],
      checks: 'passing',
      report: reports.at(-1) ?? null,
      reports,
    });
  }
}

export function call(
  sessionId: string,
  at: string,
  input: number,
  agent?: string,
): typeof apiCall.$inferInsert {
  callNumber += 1;
  return {
    sourcePath: `/logs/${sessionId}.jsonl`,
    requestKey: `req_${String(callNumber)}`,
    sessionId,
    subAgentId: agent ?? null,
    at: new Date(at),
    model: 'claude-sonnet-4-5',
    inputTokens: input,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    outputTokens: 0,
  };
}

export function builder(
  id: string,
  number: number,
  sessionId = 's1',
): typeof subAgent.$inferInsert {
  return {
    sessionId,
    id,
    agentType: 'builder',
    description: `Build #${String(number)}`,
    firstAt: new Date('2026-03-01T00:00:00Z'),
  };
}

const ISSUES: Seed[] = [
  {
    number: 1,
    labels: ['feature'],
    createdAt: '2026-03-10T00:00:00Z',
    merges: [{ at: '2026-03-14T00:00:00Z' }],
  },
  {
    number: 2,
    labels: ['Bug'],
    createdAt: '2026-03-13T00:00:00Z',
    reopened: true,
    merges: [
      {
        at: '2026-03-13T12:00:00Z',
        reports: [report('2026-03-13T11:00:00Z', 60)],
      },
      {
        at: '2026-03-15T00:00:00Z',
        reports: [
          report('2026-03-13T18:00:00Z', 60),
          report('2026-03-14T20:00:00Z', 90),
        ],
      },
    ],
  },
  {
    number: 3,
    labels: ['bug'],
    createdAt: '2026-03-01T00:00:00Z',
    merges: [{ at: '2026-03-08T00:00:00Z' }],
  },
  {
    number: 4,
    labels: ['bug'],
    createdAt: '2026-03-10T00:00:00Z',
    closedAt: '2026-03-16T00:00:00Z',
  },
  {
    number: 5,
    labels: ['bug'],
    createdAt: '2026-03-16T00:00:00Z',
    merges: [{ at: '2026-03-17T00:00:00Z' }],
  },
  {
    number: 6,
    labels: ['bug', 'agent:needs-spec'],
    createdAt: '2026-03-16T00:00:00Z',
    needsSpec: [{ added: true, at: '2026-03-16T06:00:00Z' }],
  },
  {
    number: 7,
    labels: ['agent:needs-spec'],
    createdAt: '2026-03-16T00:00:00Z',
    needsSpec: [{ added: true, at: '2026-03-16T08:00:00Z' }],
  },
  {
    project: PLAIN,
    number: 1,
    labels: ['bug'],
    createdAt: '2026-03-14T00:00:00Z',
    merges: [{ at: '2026-03-15T00:00:00Z' }],
  },
];

export async function seedKinds(db: Database): Promise<void> {
  await db.insert(gitHostProject).values([
    {
      project: APP,
      gitHost: 'github',
      syncedFrom: NOW,
      stageLabels: LABELS,
      autoMerge: true,
      bugLabel: 'bug',
    },
    {
      project: PLAIN,
      gitHost: 'github',
      syncedFrom: NOW,
      stageLabels: LABELS,
      autoMerge: true,
    },
  ]);
  for (const issue of ISSUES) await seed(db, issue);
  await db.insert(session).values([
    { id: 's1', project: APP, title: 'Build queue' },
    { id: 's2', project: APP, title: 'Chat' },
  ]);
  await db
    .insert(subAgent)
    .values([builder('a1', 1), builder('a2', 2), builder('a4', 4)]);
  await db
    .insert(apiCall)
    .values([
      call('s1', '2026-03-13T06:00:00Z', 1_000_000, 'a1'),
      call('s1', '2026-03-14T06:00:00Z', 2_000_000, 'a2'),
      call('s1', '2026-03-14T08:00:00Z', 500_000, 'a4'),
      call('s1', '2026-03-14T10:00:00Z', 350_000),
      call('s2', '2026-03-15T00:00:00Z', 400_000),
    ]);
}

export const factory = (): Promise<boolean> => Promise.resolve(true);

export function query(
  period: Period,
  kind?: IssueKind,
  project = APP,
): AutonomyQuery {
  return {
    period,
    timeZone: 'UTC',
    project,
    now: NOW,
    ...(kind === undefined ? {} : { kind }),
  };
}
