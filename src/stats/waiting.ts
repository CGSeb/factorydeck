import type { Database } from '../db/client.ts';
import { type IssueKind, kindOf } from '../git-host/kind.ts';
import type { IssueRow, RequestRow } from '../git-host/query.ts';
import { projectNames } from '../projects/names.ts';
import {
  MERGED_STAGES,
  type ProjectState,
  issueFacts,
  loadIssues,
} from './autonomy.ts';
import type { SerenityReport } from '../git-host/types.ts';
import {
  type Stop,
  latestReport,
  refusing,
  reportStops,
  storedReports,
} from './stops.ts';
import type { WaitReason, WaitingIssue, WaitingList } from './types.ts';

export interface WaitingFacts {
  project: string;
  number: number;
  title: string;
  kind: IssueKind;
  reasons: WaitReason[];
  since: number | null;
  score?: number;
}

function reportReasons(
  reports: readonly SerenityReport[],
  openStops: readonly Stop[],
): { reasons: WaitReason[]; score?: number } {
  if (openStops.length === 0) return { reasons: [] };
  const starts = new Set(openStops.map((stop) => stop.at));
  const below = latestReport(
    reports.filter(
      (report) =>
        refusing(report) &&
        starts.has(Date.parse(report.at)) &&
        report.score < report.threshold,
    ),
  );
  return below === null
    ? { reasons: ['gates-failed'] }
    : { reasons: ['below-threshold'], score: below.score };
}

export function waitingFacts(
  issue: IssueRow,
  requests: RequestRow[],
  state: ProjectState,
): WaitingFacts | null {
  const facts = issueFacts(issue, requests, state);
  if (!facts.open || facts.stage === 'closed' || MERGED_STAGES.has(facts.stage))
    return null;
  const reports = storedReports(requests);
  const openReports = reportStops(reports, facts.mergedAt, null).filter(
    (stop) => stop.end === null,
  );
  const openEpisodes = facts.episodes.filter(
    (episode) => episode.removedAt === null,
  );
  const reasons: WaitReason[] = [];
  if (facts.stage === 'blocked') reasons.push('blocked');
  if (openEpisodes.length > 0 || facts.stage === 'needs-spec') {
    reasons.push('spec-question');
  }
  const { reasons: stopReasons, ...scored } = reportReasons(
    reports,
    openReports,
  );
  reasons.push(...stopReasons);
  if (reasons.length === 0) return null;
  const starts = [
    ...openEpisodes.map((episode) => episode.at),
    ...openReports.map((stop) => stop.at),
  ];
  return {
    project: issue.project,
    number: issue.number,
    title: issue.title,
    kind: kindOf(issue, state.bugLabel),
    reasons,
    since: starts.length === 0 ? null : Math.min(...starts),
    ...scored,
  };
}

export function byLongestWait(left: WaitingFacts, right: WaitingFacts): number {
  if (left.since !== null && right.since !== null && left.since !== right.since)
    return left.since - right.since;
  if (left.since === null && right.since !== null) return 1;
  if (left.since !== null && right.since === null) return -1;
  return right.number - left.number;
}

export function waitingRows(
  facts: readonly (WaitingFacts | null)[],
  label: (project: string) => string,
): WaitingIssue[] {
  return facts
    .filter((fact): fact is WaitingFacts => fact !== null)
    .sort(byLongestWait)
    .map((fact) => ({
      project: fact.project,
      projectName: label(fact.project),
      number: fact.number,
      title: fact.title,
      kind: fact.kind,
      reasons: fact.reasons,
      since: fact.since === null ? null : new Date(fact.since).toISOString(),
      ...(fact.score === undefined ? {} : { score: fact.score }),
    }));
}

export async function waitingIssues(
  db: Database,
  project: string | undefined,
  kind?: IssueKind,
): Promise<WaitingList> {
  const [facts, names] = await Promise.all([
    loadIssues(db, project, waitingFacts),
    projectNames(db),
  ]);
  const kept =
    kind === undefined ? facts : facts.filter((fact) => fact?.kind === kind);
  return {
    issues: waitingRows(kept, (name) => names.label(name)),
    projects: names.options(),
  };
}
