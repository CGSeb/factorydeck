import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { gitHostIssue, gitHostProject, gitHostRequest } from '../db/schema.ts';
import type { Period } from '../overview/types.ts';
import { needsSpecEpisodes } from '../git-host/milestones.ts';
import { refusalReasons } from '../git-host/outcome.ts';
import {
  type IssueRow,
  type RequestRow,
  outcomeOf,
} from '../git-host/query.ts';
import type { IssueStage } from '../git-host/types.ts';
import type {
  AutonomyCounts,
  AutonomyReasons,
  AutonomyStats,
  AutonomyWeek,
} from './types.ts';
import { type StatsBounds, statsBounds } from './bounds.ts';

export interface AutonomyQuery {
  period: Period;
  timeZone: string;
  project?: string | undefined;
  now?: Date;
}

export type FactoryFilter = (project: string) => Promise<boolean>;

export interface Episode {
  at: number;
  removedAt: number | null;
}

export type PersonReason =
  'spec-question' | 'below-threshold' | 'gates-failed' | 'auto-merge-off';

export interface IssueFacts {
  open: boolean;
  stage: IssueStage;
  mergedAt: number | null;
  episodes: Episode[];
  reasons: PersonReason[];
}

export interface Window {
  from: number | null;
  to: number | null;
}

export const MERGED_STAGES: ReadonlySet<IssueStage> = new Set([
  'merged',
  'merged-after-person',
  'merged-by-person',
]);

function time(value: string): number {
  return Date.parse(value);
}

export function mergeTime(requests: readonly RequestRow[]): number | null {
  let found: number | null = null;
  for (const request of requests) {
    if (request.state !== 'merged') continue;
    const at = (request.mergedAt ?? request.updatedAt).getTime();
    if (found === null || at > found) found = at;
  }
  return found;
}

function reasonsOf(
  {
    stage,
    mergedAt,
    episodes,
  }: { stage: IssueStage; mergedAt: number; episodes: readonly Episode[] },
  requests: readonly RequestRow[],
  autoMerge: boolean | null,
): PersonReason[] {
  const reasons = new Set<PersonReason>();
  if (episodes.some((episode) => episode.at < mergedAt)) {
    reasons.add('spec-question');
  }
  for (const request of requests) {
    for (const report of request.reports) {
      if (time(report.at) >= mergedAt) continue;
      for (const reason of refusalReasons(report, null)) reasons.add(reason);
    }
  }
  if (stage === 'merged-by-person' && autoMerge === false) {
    reasons.add('auto-merge-off');
  }
  return [...reasons];
}

export function issueFacts(
  issue: IssueRow,
  requests: RequestRow[],
  state: {
    stageLabels: Parameters<typeof outcomeOf>[2]['stageLabels'];
    autoMerge: boolean | null;
  },
): IssueFacts {
  const { stage } = outcomeOf(issue, requests, state);
  const episodes = needsSpecEpisodes(issue.needsSpec).map((episode) => ({
    at: time(episode.at),
    removedAt: episode.removedAt === null ? null : time(episode.removedAt),
  }));
  const mergedAt = MERGED_STAGES.has(stage) ? mergeTime(requests) : null;
  return {
    open: issue.state !== 'closed',
    stage,
    mergedAt,
    episodes,
    reasons:
      mergedAt === null || stage === 'merged'
        ? []
        : reasonsOf({ stage, mergedAt, episodes }, requests, state.autoMerge),
  };
}

export function inside(at: number, { from, to }: Window): boolean {
  return (from === null || at >= from) && (to === null || at < to);
}

function mergedIn(issues: readonly IssueFacts[], window: Window): IssueFacts[] {
  return issues.filter(
    (issue) => issue.mergedAt !== null && inside(issue.mergedAt, window),
  );
}

export function autonomyCounts(
  issues: readonly IssueFacts[],
  window: Window,
): AutonomyCounts {
  const merged = mergedIn(issues, window);
  return {
    merged: merged.length,
    mergedWithoutPerson: merged.filter((issue) => issue.stage === 'merged')
      .length,
    mergedAfterQuestion: merged.filter((issue) =>
      issue.episodes.some(
        (episode) => issue.mergedAt !== null && episode.at < issue.mergedAt,
      ),
    ).length,
    answeredWaitsMs: issues
      .flatMap((issue) => issue.episodes)
      .flatMap((episode) =>
        episode.removedAt !== null && inside(episode.removedAt, window)
          ? [episode.removedAt - episode.at]
          : [],
      )
      .sort((a, b) => a - b),
  };
}

export function waitingNow(issues: readonly IssueFacts[]): number {
  return issues.filter(
    (issue) => issue.open && issue.episodes.at(-1)?.removedAt === null,
  ).length;
}

export function reasonCounts(
  issues: readonly IssueFacts[],
  window: Window,
): AutonomyReasons {
  const helped = mergedIn(issues, window).filter(
    (issue) => issue.stage !== 'merged',
  );
  const count = (reason: PersonReason): number =>
    helped.filter((issue) => issue.reasons.includes(reason)).length;
  return {
    specQuestion: count('spec-question'),
    belowThreshold: count('below-threshold'),
    gatesFailed: count('gates-failed'),
    autoMergeOff: count('auto-merge-off'),
    total: helped.length,
  };
}

export function weekCounts(
  issues: readonly IssueFacts[],
  weeks: StatsBounds['weeks'],
): AutonomyWeek[] {
  return weeks.map((week, index) => {
    const merged = mergedIn(issues, {
      from: week.start,
      to: weeks[index + 1]?.start ?? null,
    });
    return {
      start: week.day,
      merged: merged.length,
      mergedWithoutPerson: merged.filter((issue) => issue.stage === 'merged')
        .length,
    };
  });
}

export function summarize(
  issues: readonly IssueFacts[],
  bounds: StatsBounds,
): AutonomyStats {
  const current = { from: bounds.start, to: null };
  return {
    current: autonomyCounts(issues, current),
    ...(bounds.start === null || bounds.previousStart === null
      ? {}
      : {
          previous: autonomyCounts(issues, {
            from: bounds.previousStart,
            to: bounds.start,
          }),
        }),
    waitingNow: waitingNow(issues),
    weeks: weekCounts(issues, bounds.weeks),
    reasons: reasonCounts(issues, current),
  };
}

async function factoryProjects(
  db: Database,
  project: string | undefined,
  hasFactory: FactoryFilter,
) {
  const rows = await db
    .select({
      project: gitHostProject.project,
      stageLabels: gitHostProject.stageLabels,
      autoMerge: gitHostProject.autoMerge,
    })
    .from(gitHostProject)
    .where(
      and(
        isNotNull(gitHostProject.syncedFrom),
        project === undefined ? undefined : eq(gitHostProject.project, project),
      ),
    );
  const kept = [];
  for (const row of rows) {
    if (await hasFactory(row.project)) kept.push(row);
  }
  return kept;
}

export type ProjectState = Parameters<typeof issueFacts>[2];

export async function loadIssues<T>(
  db: Database,
  project: string | undefined,
  hasFactory: FactoryFilter,
  build: (issue: IssueRow, requests: RequestRow[], state: ProjectState) => T,
): Promise<T[]> {
  const projects = await factoryProjects(db, project, hasFactory);
  if (projects.length === 0) return [];
  const names = projects.map((row) => row.project);
  const [issues, requests] = await Promise.all([
    db.select().from(gitHostIssue).where(inArray(gitHostIssue.project, names)),
    db
      .select()
      .from(gitHostRequest)
      .where(inArray(gitHostRequest.project, names))
      .orderBy(gitHostRequest.project, gitHostRequest.number),
  ]);
  const stateOf = new Map(projects.map((row) => [row.project, row]));
  const requestsOf = new Map<string, RequestRow[]>();
  for (const request of requests) {
    for (const number of request.closes) {
      const key = `${String(number)} ${request.project}`;
      requestsOf.set(key, [...(requestsOf.get(key) ?? []), request]);
    }
  }
  return issues.flatMap((issue) => {
    const state = stateOf.get(issue.project);
    if (state === undefined) return [];
    return [
      build(
        issue,
        requestsOf.get(`${String(issue.number)} ${issue.project}`) ?? [],
        state,
      ),
    ];
  });
}

export function loadIssueFacts(
  db: Database,
  project: string | undefined,
  hasFactory: FactoryFilter,
): Promise<IssueFacts[]> {
  return loadIssues(db, project, hasFactory, issueFacts);
}

export async function autonomyStats(
  db: Database,
  query: AutonomyQuery,
  hasFactory: FactoryFilter,
): Promise<AutonomyStats> {
  const [issues, bounds] = await Promise.all([
    loadIssueFacts(db, query.project, hasFactory),
    statsBounds(db, query),
  ]);
  return summarize(issues, bounds);
}
