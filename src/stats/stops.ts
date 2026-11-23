import type { RequestRow } from '../git-host/query.ts';
import { refusalReasons } from '../git-host/outcome.ts';
import type { SerenityReport } from '../git-host/types.ts';
import type { Episode } from './autonomy.ts';

export interface Stop {
  at: number;
  end: number | null;
}

export type HelpRow =
  | 'below-1-5'
  | 'below-6-15'
  | 'below-16'
  | 'gates-failed'
  | 'spec-question'
  | 'auto-merge-off';

function time(value: string): number {
  return Date.parse(value);
}

export function storedReports(
  requests: readonly Pick<RequestRow, 'reports'>[],
): SerenityReport[] {
  return requests.flatMap((request) => request.reports);
}

export function earliestReport(
  reports: readonly SerenityReport[],
): SerenityReport | null {
  let found: SerenityReport | null = null;
  for (const report of reports) {
    if (found === null || time(report.at) < time(found.at)) found = report;
  }
  return found;
}

export function latestReport(
  reports: readonly SerenityReport[],
): SerenityReport | null {
  let found: SerenityReport | null = null;
  for (const report of reports) {
    if (found === null || time(report.at) > time(found.at)) found = report;
  }
  return found;
}

export function refusing(report: SerenityReport): boolean {
  return refusalReasons(report, null).length > 0;
}

function earliestAfter(
  at: number,
  candidates: readonly number[],
): number | null {
  let found: number | null = null;
  for (const candidate of candidates) {
    if (candidate > at && (found === null || candidate < found)) {
      found = candidate;
    }
  }
  return found;
}

export function reportStops(
  reports: readonly SerenityReport[],
  mergedAt: number | null,
  closedAt: number | null,
): Stop[] {
  const ends = [
    ...reports.map((report) => time(report.at)),
    ...(mergedAt === null ? [] : [mergedAt]),
    ...(closedAt === null ? [] : [closedAt]),
  ];
  return reports.flatMap((report) => {
    const at = time(report.at);
    if (!refusing(report) || (mergedAt !== null && at >= mergedAt)) return [];
    return [{ at, end: earliestAfter(at, ends) }];
  });
}

export function belowRow(gap: number): HelpRow {
  if (gap <= 5) return 'below-1-5';
  if (gap <= 15) return 'below-6-15';
  return 'below-16';
}

export function helpRow(
  refused: readonly SerenityReport[],
  episodes: readonly Episode[],
  mergedAt: number,
): HelpRow {
  const latest = latestReport(refused);
  if (latest !== null && latest.score < latest.threshold) {
    return belowRow(latest.threshold - latest.score);
  }
  if (latest !== null) return 'gates-failed';
  if (episodes.some((episode) => episode.at < mergedAt)) return 'spec-question';
  return 'auto-merge-off';
}
