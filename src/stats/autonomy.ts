import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { gitHostIssue, gitHostProject, gitHostRequest } from '../db/schema.ts';
import type { Period } from '../overview/types.ts';
import { needsSpecEpisodes } from '../git-host/milestones.ts';
import {
  type IssueRow,
  type RequestRow,
  outcomeOf,
} from '../git-host/query.ts';
import type { IssueStage } from '../git-host/types.ts';
import {
  type HelpRow,
  type Stop,
  helpRow,
  refusing,
  reportStops,
  storedReports,
} from './stops.ts';
import type {
  AutonomyCounts,
  AutonomyReasons,
  AutonomyStats,
  AutonomyBucket,
} from './types.ts';
import { type StatsBounds, earliestMerge, statsBounds } from './bounds.ts';

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

export interface IssueFacts {
  open: boolean;
  stage: IssueStage;
  mergedAt: number | null;
  episodes: Episode[];
  stops: Stop[];
  row: HelpRow | null;
  rounds: number[];
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
  const open = issue.state !== 'closed';
  const reports = storedReports(requests);
  const closedAt =
    open || issue.closedAt === null ? null : issue.closedAt.getTime();
  const helped = mergedAt !== null && stage !== 'merged';
  const refused = helped
    ? reports.filter((report) => refusing(report) && time(report.at) < mergedAt)
    : [];
  return {
    open,
    stage,
    mergedAt,
    episodes,
    stops: [
      ...episodes.map((episode) => ({
        at: episode.at,
        end: episode.removedAt,
      })),
      ...reportStops(reports, mergedAt, closedAt),
    ],
    row: helped ? helpRow(refused, episodes, mergedAt) : null,
    rounds: refused.flatMap((report) =>
      report.rounds === null ? [] : [report.rounds],
    ),
  };
}

export function inside(at: number, { from, to }: Window): boolean {
  return (from === null || at >= from) && (to === null || at < to);
}

export function mergedIn<T extends IssueFacts>(
  issues: readonly T[],
  window: Window,
): T[] {
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
    stopWaitsMs: issues
      .flatMap((issue) => issue.stops)
      .flatMap((stop) =>
        stop.end !== null && inside(stop.end, window)
          ? [stop.end - stop.at]
          : [],
      )
      .sort((a, b) => a - b),
  };
}

export function waitingNow(issues: readonly IssueFacts[]): number {
  return issues.filter(
    (issue) => issue.open && issue.stops.some((stop) => stop.end === null),
  ).length;
}

export function reasonCounts(
  issues: readonly IssueFacts[],
  window: Window,
): AutonomyReasons {
  const helped = mergedIn(issues, window).filter((issue) => issue.row !== null);
  const count = (row: HelpRow): number =>
    helped.filter((issue) => issue.row === row).length;
  const rounds = helped.flatMap((issue) => issue.rounds);
  return {
    below1To5: count('below-1-5'),
    below6To15: count('below-6-15'),
    below16Plus: count('below-16'),
    gatesFailed: count('gates-failed'),
    specQuestion: count('spec-question'),
    autoMergeOff: count('auto-merge-off'),
    total: helped.length,
    roundsSum: rounds.reduce((sum, value) => sum + value, 0),
    roundsCount: rounds.length,
  };
}

export function bucketCounts(
  issues: readonly IssueFacts[],
  buckets: StatsBounds['buckets'],
): AutonomyBucket[] {
  return buckets.map((bucket, index) => {
    const merged = mergedIn(issues, {
      from: bucket.start,
      to: buckets[index + 1]?.start ?? null,
    });
    return {
      start: bucket.key,
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
    unit: bounds.unit,
    buckets: bucketCounts(issues, bounds.buckets),
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
      bugLabel: gitHostProject.bugLabel,
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

export type ProjectState = Parameters<typeof issueFacts>[2] & {
  bugLabel: string | null;
};

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
  const issues = await loadIssueFacts(db, query.project, hasFactory);
  const bounds = await statsBounds(db, {
    ...query,
    earliestMerge: earliestMerge(issues),
  });
  return summarize(issues, bounds);
}
