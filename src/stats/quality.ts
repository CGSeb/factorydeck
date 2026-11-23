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
import { earliestReport, latestReport, storedReports } from './stops.ts';
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
  first: (FirstReport & { passed: boolean }) | null;
  rounds: number | null;
  gain: number | null;
}

export function firstReport(
  requests: readonly Pick<RequestRow, 'reports'>[],
): SerenityReport | null {
  return earliestReport(storedReports(requests));
}

export function scoreGain(
  requests: readonly Pick<RequestRow, 'reports'>[],
  mergedAt: number | null,
): number | null {
  if (mergedAt === null) return null;
  const reports = storedReports(requests).filter(
    (report) => Date.parse(report.at) <= mergedAt,
  );
  const earliest = earliestReport(reports);
  const latest = latestReport(reports);
  if (reports.length < 2 || earliest === null || latest === null) return null;
  return latest.score - earliest.score;
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
  const mergedAt = MERGED_STAGES.has(outcome.stage)
    ? mergeTime(requests)
    : null;
  return {
    stage: outcome.stage,
    mergedAt,
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
    gain: scoreGain(requests, mergedAt),
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
  const gains = merged.flatMap((issue) =>
    issue.gain === null ? [] : [issue.gain],
  );
  return {
    merged: merged.length,
    mergedWithReport: withReport.length,
    firstPassed: withReport.filter((issue) => issue.first?.passed === true)
      .length,
    roundsSum: rounds.reduce((sum, value) => sum + value, 0),
    roundsCount: rounds.length,
    gainSum: gains.reduce((sum, value) => sum + value, 0),
    gainCount: gains.length,
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
