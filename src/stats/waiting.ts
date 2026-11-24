import type { Database } from '../db/client.ts';
import type { IssueRow, RequestRow } from '../git-host/query.ts';
import { projectNames } from '../projects/names.ts';
import {
  type FactoryFilter,
  MERGED_STAGES,
  type ProjectState,
  issueFacts,
  loadIssues,
} from './autonomy.ts';
import { refusing, reportStops, storedReports } from './stops.ts';
import type { WaitReason, WaitingIssue, WaitingList } from './types.ts';

export interface WaitingFacts {
  project: string;
  number: number;
  title: string;
  reasons: WaitReason[];
  since: number | null;
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
  if (openReports.length > 0) {
    const starts = new Set(openReports.map((stop) => stop.at));
    const below = reports.some(
      (report) =>
        refusing(report) &&
        starts.has(Date.parse(report.at)) &&
        report.score < report.threshold,
    );
    reasons.push(below ? 'below-threshold' : 'gates-failed');
  }
  if (reasons.length === 0) return null;
  const starts = [
    ...openEpisodes.map((episode) => episode.at),
    ...openReports.map((stop) => stop.at),
  ];
  return {
    project: issue.project,
    number: issue.number,
    title: issue.title,
    reasons,
    since: starts.length === 0 ? null : Math.min(...starts),
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
      reasons: fact.reasons,
      since: fact.since === null ? null : new Date(fact.since).toISOString(),
    }));
}

export async function waitingIssues(
  db: Database,
  project: string | undefined,
  hasFactory: FactoryFilter,
): Promise<WaitingList> {
  const [facts, names] = await Promise.all([
    loadIssues(db, project, hasFactory, waitingFacts),
    projectNames(db),
  ]);
  return {
    issues: waitingRows(facts, (name) => names.label(name)),
    projects: names.options(),
  };
}
