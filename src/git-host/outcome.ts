import type {
  IssueOutcome,
  IssueStage,
  IssueState,
  LabelChange,
  RefusalReason,
  RequestState,
  SerenityReport,
} from './types.ts';

export const STAGE_LABEL_KEYS = [
  'blocked',
  'needs_spec',
  'review',
  'working',
  'ready',
] as const;

export type StageLabelKey = (typeof STAGE_LABEL_KEYS)[number];

export type StageLabels = Record<StageLabelKey, string>;

const LABEL_STAGES: Record<StageLabelKey, IssueStage> = {
  blocked: 'blocked',
  needs_spec: 'needs-spec',
  review: 'in-review',
  working: 'working',
  ready: 'ready',
};

export interface OutcomeSettings {
  labels: StageLabels | null;
  autoMerge: boolean | null;
}

export interface OutcomeRequest {
  state: RequestState;
  mergedAt: string | null;
  updatedAt: string;
  report: SerenityReport | null;
  reports: readonly SerenityReport[];
}

export interface OutcomeIssue {
  state: IssueState;
  labels: readonly string[];
  reopened: boolean;
  needsSpec: readonly LabelChange[];
}

function latest(
  requests: readonly OutcomeRequest[],
  timeOf: (request: OutcomeRequest) => string,
): OutcomeRequest | undefined {
  let found: OutcomeRequest | undefined;
  for (const request of requests) {
    if (found === undefined || timeOf(request) > timeOf(found)) found = request;
  }
  return found;
}

export function refusalReasons(
  report: SerenityReport,
  autoMerge: boolean | null,
): RefusalReason[] {
  const reasons: RefusalReason[] = [];
  if (report.score < report.threshold) reasons.push('below-threshold');
  if (!report.gatesPassed) reasons.push('gates-failed');
  if (autoMerge === false) reasons.push('auto-merge-off');
  return reasons;
}

export function mergeRefused(
  report: SerenityReport,
  autoMerge: boolean | null,
): boolean {
  return refusalReasons(report, autoMerge).length > 0;
}

export function firstScore(
  request: Pick<OutcomeRequest, 'report' | 'reports'>,
): number | undefined {
  if (request.report === null || request.reports.length < 2) return undefined;
  const first = [...request.reports].sort((a, b) =>
    a.at < b.at ? -1 : a.at > b.at ? 1 : 0,
  )[0];
  return first === undefined || first.score === request.report.score
    ? undefined
    : first.score;
}

function scoreOrGatesRefused(report: SerenityReport): boolean {
  return mergeRefused(report, null);
}

function personHelped(
  issue: OutcomeIssue,
  requests: readonly OutcomeRequest[],
  mergedAt: string,
): boolean {
  const refused = requests.some((request) =>
    request.reports.some(
      (report) => report.at < mergedAt && scoreOrGatesRefused(report),
    ),
  );
  return (
    refused ||
    issue.needsSpec.some((change) => change.added && change.at < mergedAt)
  );
}

function labelStage(
  labels: readonly string[],
  stageLabels: StageLabels | null,
): IssueStage | undefined {
  if (stageLabels === null) return undefined;
  const carried = new Set(labels.map((label) => label.trim().toLowerCase()));
  const key = STAGE_LABEL_KEYS.find((name) =>
    carried.has(stageLabels[name].trim().toLowerCase()),
  );
  return key === undefined ? undefined : LABEL_STAGES[key];
}

function mergedStage(
  issue: OutcomeIssue,
  requests: readonly OutcomeRequest[],
  merged: OutcomeRequest,
  autoMerge: boolean | null,
): IssueStage {
  if (merged.report !== null && mergeRefused(merged.report, autoMerge)) {
    return 'merged-by-person';
  }
  return personHelped(issue, requests, merged.mergedAt ?? merged.updatedAt)
    ? 'merged-after-person'
    : 'merged';
}

export function issueOutcome(
  issue: OutcomeIssue,
  requests: readonly OutcomeRequest[],
  settings: OutcomeSettings,
): IssueOutcome {
  const merged = latest(
    requests.filter((request) => request.state === 'merged'),
    (request) => request.mergedAt ?? request.updatedAt,
  );
  const counted =
    merged ??
    latest(
      requests.filter((request) => request.state === 'open'),
      (request) => request.updatedAt,
    );
  const report = counted?.report ?? null;
  const first = counted === undefined ? undefined : firstScore(counted);
  let stage: IssueStage;
  if (merged !== undefined) {
    stage = mergedStage(issue, requests, merged, settings.autoMerge);
  } else if (issue.state === 'closed') {
    stage = 'closed';
  } else {
    stage = labelStage(issue.labels, settings.labels) ?? 'open';
  }
  return {
    stage,
    report:
      report === null
        ? null
        : {
            score: report.score,
            threshold: report.threshold,
            rounds: report.rounds,
            ...(first === undefined ? {} : { firstScore: first }),
          },
    reworked: requests.length > 1 || issue.reopened,
  };
}
