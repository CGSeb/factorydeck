import { kindOf } from '../git-host/kind.ts';
import {
  type OutcomeRequest,
  type StageLabels,
  countedRequest,
  labelStage,
  mergedRequest,
} from '../git-host/outcome.ts';
import {
  type RequestRow,
  outcomeRequest,
} from '../git-host/outcome-request.ts';
import { type IssueRow, outcomeOf } from '../git-host/query.ts';
import type {
  IssueOutcome,
  IssueStage,
  SerenityReport,
} from '../git-host/types.ts';
import { emptyCounts } from '../overview/tokens.ts';
import type { TokenCounts } from '../overview/types.ts';
import type { BugCounts, BugFix, BugGroup, BugRow } from './types.ts';

export interface BugProject {
  project: string;
  name: string;
  stageLabels: StageLabels | null;
  autoMerge: boolean | null;
  bugLabel: string;
}

export interface BugUsage {
  tokens: number;
  tokenCounts: TokenCounts;
  costUsd: number | null;
  lastAt: string | null;
}

export interface BugSources {
  projects: readonly BugProject[];
  issues: readonly IssueRow[];
  requests: readonly RequestRow[];
  usage: (project: string, number: number) => BugUsage | undefined;
  startAt: string | null;
}

const OPEN_STAGES: ReadonlySet<IssueStage> = new Set([
  'open',
  'ready',
  'needs-spec',
  'blocked',
]);

const FIXING_STAGES: ReadonlySet<IssueStage> = new Set([
  'working',
  'in-review',
]);

const MERGED_STAGES: ReadonlySet<IssueStage> = new Set([
  'merged',
  'merged-by-person',
  'merged-after-person',
]);

const NO_USAGE: BugUsage = {
  tokens: 0,
  tokenCounts: emptyCounts(),
  costUsd: 0,
  lastAt: null,
};

interface Placed {
  group: BugGroup;
  row: BugRow;
  endAt: string | null;
}

function fixOf(report: SerenityReport | null | undefined): BugFix | null {
  if (report == null) return null;
  return {
    rootCause: report.rootCause ?? null,
    reproduced: report.reproduced ?? null,
  };
}

function inPeriod(at: string, startAt: string | null): boolean {
  return startAt === null || Date.parse(at) >= Date.parse(startAt);
}

function openStage(
  stage: IssueStage,
  issue: IssueRow,
  project: BugProject,
): IssueStage {
  if (OPEN_STAGES.has(stage) || FIXING_STAGES.has(stage)) return stage;
  return (
    labelStage(
      issue.labels.map((label) => label.name),
      project.stageLabels,
    ) ?? 'open'
  );
}

type BaseRow = Omit<BugRow, 'stage' | 'mergedAt' | 'closedAt'>;

function baseRow(
  issue: IssueRow,
  project: BugProject,
  outcome: IssueOutcome,
  requests: readonly OutcomeRequest[],
): Omit<BaseRow, keyof BugUsage> {
  return {
    project: issue.project,
    projectName: project.name,
    number: issue.number,
    title: issue.title,
    url: issue.url,
    createdAt: issue.createdAt.toISOString(),
    fix: fixOf(countedRequest(requests)?.report),
    score: outcome.report?.score ?? null,
    threshold: outcome.report?.threshold ?? null,
  };
}

function endedAt(
  issue: IssueRow,
  stage: IssueStage,
  requests: readonly OutcomeRequest[],
): { mergedAt: string | null; closedAt: string | null } | undefined {
  if (MERGED_STAGES.has(stage)) {
    if (issue.state !== 'closed' && issue.reopened) return undefined;
    const request = mergedRequest(requests);
    return {
      mergedAt: request?.mergedAt ?? request?.updatedAt ?? null,
      closedAt: null,
    };
  }
  if (stage !== 'closed') return undefined;
  return {
    mergedAt: null,
    closedAt: (issue.closedAt ?? issue.updatedAt).toISOString(),
  };
}

function placeBug(
  issue: IssueRow,
  project: BugProject,
  sources: BugSources,
): Placed | undefined {
  const closing = sources.requests.filter(
    (request) =>
      request.project === issue.project &&
      request.closes.includes(issue.number),
  );
  const outcome = outcomeOf(issue, closing, project);
  const requests = closing.map(outcomeRequest);
  const base = {
    ...baseRow(issue, project, outcome, requests),
    ...(sources.usage(issue.project, issue.number) ?? NO_USAGE),
  };
  const ended = endedAt(issue, outcome.stage, requests);
  if (ended !== undefined) {
    const endAt = ended.mergedAt ?? ended.closedAt;
    if (endAt === null || !inPeriod(endAt, sources.startAt)) return undefined;
    return {
      group: 'fixed',
      row: { ...base, stage: outcome.stage, ...ended },
      endAt,
    };
  }
  const stage = openStage(outcome.stage, issue, project);
  return {
    group: FIXING_STAGES.has(stage) ? 'fixing' : 'open',
    row: { ...base, stage, mergedAt: null, closedAt: null },
    endAt: null,
  };
}

function timeOf(at: string | null): number | null {
  return at === null ? null : Date.parse(at);
}

function latestFirst(a: number | null, b: number | null): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  return b - a;
}

function ties(left: Placed, right: Placed): number {
  return (
    right.row.number - left.row.number ||
    left.row.project.localeCompare(right.row.project)
  );
}

const ORDERS: Record<BugGroup, (left: Placed, right: Placed) => number> = {
  open: (left, right) =>
    Date.parse(left.row.createdAt) - Date.parse(right.row.createdAt),
  fixing: (left, right) =>
    latestFirst(timeOf(left.row.lastAt), timeOf(right.row.lastAt)),
  fixed: (left, right) => latestFirst(timeOf(left.endAt), timeOf(right.endAt)),
};

export function bugGroups(sources: BugSources): {
  groups: Record<BugGroup, BugRow[]>;
  counts: BugCounts;
} {
  const projectOf = new Map(sources.projects.map((row) => [row.project, row]));
  const placed: Placed[] = [];
  for (const issue of sources.issues) {
    const project = projectOf.get(issue.project);
    if (project === undefined || kindOf(issue, project.bugLabel) !== 'bug') {
      continue;
    }
    const found = placeBug(issue, project, sources);
    if (found !== undefined) placed.push(found);
  }
  const groupOf = (group: BugGroup): BugRow[] =>
    placed
      .filter((item) => item.group === group)
      .sort((left, right) => ORDERS[group](left, right) || ties(left, right))
      .map((item) => item.row);
  const groups = {
    open: groupOf('open'),
    fixing: groupOf('fixing'),
    fixed: groupOf('fixed'),
  };
  return {
    groups,
    counts: {
      open: groups.open.length + groups.fixing.length,
      fixed: groups.fixed.filter((row) => MERGED_STAGES.has(row.stage)).length,
      closed: groups.fixed.filter((row) => row.stage === 'closed').length,
    },
  };
}
