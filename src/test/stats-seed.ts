import type { Database } from '../db/client.ts';
import { gitHostIssue, gitHostRequest } from '../db/schema.ts';
import type { LabelChange, SerenityReport } from '../git-host/types.ts';

const CREATED = new Date('2026-01-01T00:00:00Z');

export function report(
  at: string,
  {
    score = 90,
    gatesPassed = true,
    rounds = 1,
  }: { score?: number; gatesPassed?: boolean; rounds?: number | null } = {},
): SerenityReport {
  return { score, threshold: 80, rounds, gatesPassed, at };
}

export interface RequestSeed {
  state: 'open' | 'merged' | 'closed';
  mergedAt?: string;
  reports: SerenityReport[];
}

export interface IssueSeed {
  project: string;
  number: number;
  state: 'open' | 'closed';
  closedAt?: string;
  needsSpec?: LabelChange[];
  requests?: RequestSeed[];
}

export async function seedIssues(
  db: Database,
  issues: readonly IssueSeed[],
): Promise<void> {
  let next = 1;
  for (const issue of issues) {
    await db.insert(gitHostIssue).values({
      project: issue.project,
      number: issue.number,
      title: `Issue ${String(issue.number)}`,
      state: issue.state,
      labels: [],
      url: `https://git.example/issues/${String(issue.number)}`,
      createdAt: CREATED,
      closedAt: issue.closedAt === undefined ? null : new Date(issue.closedAt),
      updatedAt: CREATED,
      needsSpec: issue.needsSpec ?? [],
    });
    for (const request of issue.requests ?? []) {
      const number = next++;
      await db.insert(gitHostRequest).values({
        project: issue.project,
        number,
        title: `Request ${String(number)}`,
        state: request.state,
        draft: false,
        headBranch: `feat/${String(number)}`,
        url: `https://git.example/pull/${String(number)}`,
        createdAt: CREATED,
        mergedAt:
          request.mergedAt === undefined ? null : new Date(request.mergedAt),
        updatedAt: new Date(request.mergedAt ?? CREATED),
        closes: [issue.number],
        checks: 'passing',
        report: request.reports.at(-1) ?? null,
        reports: request.reports,
      });
    }
  }
}

export function mergedIssue(
  project: string,
  number: number,
  at: string,
  reports: SerenityReport[],
): IssueSeed {
  return {
    project,
    number,
    state: 'closed',
    closedAt: at,
    requests: [{ state: 'merged', mergedAt: at, reports }],
  };
}
