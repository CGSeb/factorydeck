import type {
  IssueOutcome,
  IssueStage,
  IssueState,
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
}

export interface OutcomeIssue {
  state: IssueState;
  labels: readonly string[];
  reopened: boolean;
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

export function mergeRefused(
  report: SerenityReport,
  autoMerge: boolean | null,
): boolean {
  return (
    report.score < report.threshold ||
    !report.gatesPassed ||
    autoMerge === false
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
  let stage: IssueStage;
  if (merged !== undefined) {
    stage =
      report !== null && mergeRefused(report, settings.autoMerge)
        ? 'merged-by-person'
        : 'merged';
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
          },
    reworked: requests.length > 1 || issue.reopened,
  };
}
