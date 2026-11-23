import type { Database } from '../db/client.ts';
import { refusalReasons } from '../git-host/outcome.ts';
import {
  type IssueRow,
  type RequestRow,
  outcomeOf,
} from '../git-host/query.ts';
import type { IssueStage, SerenityReport } from '../git-host/types.ts';
import {
  type AutonomyQuery,
  type FactoryFilter,
  MERGED_STAGES,
  type ProjectState,
  type Window,
  inside,
  loadIssues,
  mergeTime,
} from './autonomy.ts';
import { type StatsBounds, earliestMerge, statsBounds } from './bounds.ts';
import type {
  FirstReport,
  QualityCounts,
  QualityStats,
  QualityBucket,
} from './types.ts';

export type QualityQuery = AutonomyQuery;

export interface QualityFacts {
  stage: IssueStage;
  mergedAt: number | null;
  closedAt: number | null;
  first: (FirstReport & { passed: boolean }) | null;
  rounds: number | null;
  reworked: boolean;
}

export function firstReport(
  requests: readonly Pick<RequestRow, 'reports'>[],
): SerenityReport | null {
  let found: SerenityReport | null = null;
  for (const request of requests) {
    for (const report of request.reports) {
      if (found === null || Date.parse(report.at) < Date.parse(found.at)) {
        found = report;
      }
    }
  }
  return found;
}

export function firstPassed(report: SerenityReport): boolean {
  return refusalReasons(report, null).length === 0;
}

export function qualityFacts(
  issue: IssueRow,
  requests: RequestRow[],
  state: ProjectState,
): QualityFacts {
  const outcome = outcomeOf(issue, requests, state);
  const first = firstReport(requests);
  return {
    stage: outcome.stage,
    mergedAt: MERGED_STAGES.has(outcome.stage) ? mergeTime(requests) : null,
    closedAt:
      outcome.stage === 'closed' && issue.closedAt !== null
        ? issue.closedAt.getTime()
        : null,
    first:
      first === null
        ? null
        : {
            score: first.score,
            threshold: first.threshold,
            time: first.at,
            passed: firstPassed(first),
          },
    rounds: outcome.report?.rounds ?? null,
    reworked: outcome.reworked,
  };
}

function mergedIn(
  issues: readonly QualityFacts[],
  window: Window,
): QualityFacts[] {
  return issues.filter(
    (issue) => issue.mergedAt !== null && inside(issue.mergedAt, window),
  );
}

export function qualityCounts(
  issues: readonly QualityFacts[],
  window: Window,
): QualityCounts {
  const merged = mergedIn(issues, window);
  const withReport = merged.filter((issue) => issue.first !== null);
  const rounds = merged.flatMap((issue) =>
    issue.rounds === null ? [] : [issue.rounds],
  );
  const closedWithoutMerge = issues.filter(
    (issue) => issue.closedAt !== null && inside(issue.closedAt, window),
  ).length;
  return {
    merged: merged.length,
    mergedWithReport: withReport.length,
    firstPassed: withReport.filter((issue) => issue.first?.passed === true)
      .length,
    roundsSum: rounds.reduce((sum, value) => sum + value, 0),
    roundsCount: rounds.length,
    reworked: merged.filter((issue) => issue.reworked).length,
    ended: merged.length + closedWithoutMerge,
    closedWithoutMerge,
  };
}

export function qualityBuckets(
  issues: readonly QualityFacts[],
  buckets: StatsBounds['buckets'],
): QualityBucket[] {
  return buckets.map((bucket, index) => {
    const withReport = mergedIn(issues, {
      from: bucket.start,
      to: buckets[index + 1]?.start ?? null,
    }).filter((issue) => issue.first !== null);
    return {
      start: bucket.key,
      mergedWithReport: withReport.length,
      firstPassed: withReport.filter((issue) => issue.first?.passed === true)
        .length,
    };
  });
}

export function summarizeQuality(
  issues: readonly QualityFacts[],
  bounds: StatsBounds,
): QualityStats {
  const current = { from: bounds.start, to: null };
  return {
    current: qualityCounts(issues, current),
    ...(bounds.start === null || bounds.previousStart === null
      ? {}
      : {
          previous: qualityCounts(issues, {
            from: bounds.previousStart,
            to: bounds.start,
          }),
        }),
    unit: bounds.unit,
    buckets: qualityBuckets(issues, bounds.buckets),
    firstReports: mergedIn(issues, current)
      .flatMap((issue) => (issue.first === null ? [] : [issue.first]))
      .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
      .map(({ score, threshold, time }) => ({ score, threshold, time })),
  };
}

export async function qualityStats(
  db: Database,
  query: QualityQuery,
  hasFactory: FactoryFilter,
): Promise<QualityStats> {
  const issues = await loadIssues(db, query.project, hasFactory, qualityFacts);
  const bounds = await statsBounds(db, {
    ...query,
    earliestMerge: earliestMerge(issues),
  });
  return summarizeQuality(issues, bounds);
}
