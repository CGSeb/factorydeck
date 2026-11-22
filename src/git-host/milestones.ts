import { refusalReasons } from './outcome.ts';
import type {
  IssueDetail,
  IssueMilestone,
  LabelChange,
  NeedsSpecMilestone,
  SerenityReport,
} from './types.ts';

export interface MilestoneRequest {
  number: number;
  url: string;
  reports: readonly SerenityReport[];
}

function compareAt(a: { at: string }, b: { at: string }): number {
  const left = Date.parse(a.at);
  const right = Date.parse(b.at);
  return left < right ? -1 : left > right ? 1 : 0;
}

export function needsSpecEpisodes(
  changes: readonly LabelChange[],
): NeedsSpecMilestone[] {
  const episodes: NeedsSpecMilestone[] = [];
  let open: NeedsSpecMilestone | null = null;
  for (const change of [...changes].sort(compareAt)) {
    if (change.added) {
      if (open === null) {
        open = { kind: 'needs-spec', at: change.at, removedAt: null };
        episodes.push(open);
      }
    } else if (open !== null) {
      open.removedAt = change.at;
      open = null;
    }
  }
  return episodes;
}

export function issueMilestones(
  requests: readonly MilestoneRequest[],
  needsSpec: readonly LabelChange[],
  autoMerge: boolean | null,
): IssueMilestone[] {
  const reports = requests.flatMap((request) =>
    request.reports.map((report): IssueMilestone => {
      const reasons = refusalReasons(report, autoMerge);
      return {
        kind: 'report',
        at: report.at,
        request: { number: request.number, url: request.url },
        score: report.score,
        threshold: report.threshold,
        refused: reasons.length > 0,
        reasons,
      };
    }),
  );
  return [...reports, ...needsSpecEpisodes(needsSpec)].sort(compareAt);
}

export function milestonesSince(
  milestones: readonly IssueMilestone[],
  startAt: string | null,
): IssueMilestone[] {
  if (startAt === null) return [...milestones];
  const start = Date.parse(startAt);
  return milestones.filter((milestone) => Date.parse(milestone.at) >= start);
}

export function detailInPeriod(
  detail: IssueDetail | null,
  startAt: string | null,
): IssueDetail | null {
  return detail === null
    ? null
    : { ...detail, milestones: milestonesSince(detail.milestones, startAt) };
}
