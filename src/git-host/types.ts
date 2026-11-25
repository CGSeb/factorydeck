export const GIT_HOSTS = ['github', 'gitlab'] as const;

export type GitHostName = (typeof GIT_HOSTS)[number];

export const GIT_HOST_LABELS: Record<GitHostName, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
};

export type IssueState = 'open' | 'closed';

export type RequestState = 'open' | 'merged' | 'closed';

export type ChecksSummary = 'passing' | 'failing' | 'pending' | 'none';

export interface IssueLabel {
  name: string;
  color: string | null;
}

export const REPRODUCED_VALUES = [
  'failed-on-main',
  'passed-on-main',
  'did-not-run-on-main',
  'no-test',
] as const;

export type Reproduced = (typeof REPRODUCED_VALUES)[number];

export interface SerenityReport {
  score: number;
  threshold: number;
  rounds: number | null;
  gatesPassed: boolean;
  at: string;
  rootCause?: string;
  reproduced?: Reproduced;
}

export interface LabelChange {
  added: boolean;
  at: string;
}

export interface LabelEvent extends LabelChange {
  label: string;
}

export interface IssueRecord {
  number: number;
  title: string;
  state: IssueState;
  labels: IssueLabel[];
  url: string;
  createdAt: string;
  closedAt: string | null;
  updatedAt: string;
  reopened: boolean;
  labelEvents: LabelEvent[];
}

export interface RequestRecord {
  number: number;
  title: string;
  state: RequestState;
  draft: boolean;
  headBranch: string;
  url: string;
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  updatedAt: string;
  closes: number[];
  checks: ChecksSummary;
  report: SerenityReport | null;
  reports: SerenityReport[];
}

export type WorkItemIssue =
  | { status: 'not-collected' }
  | { status: 'not-found' }
  | { status: 'found'; title: string; url: string };

export interface ClosingRequest {
  number: number;
  title: string;
  url: string;
  state: RequestState;
  draft: boolean;
  checks: ChecksSummary;
  createdAt: string;
}

export const ISSUE_STAGES = [
  'merged',
  'merged-by-person',
  'merged-after-person',
  'closed',
  'blocked',
  'needs-spec',
  'in-review',
  'working',
  'ready',
  'open',
] as const;

export type IssueStage = (typeof ISSUE_STAGES)[number];

export interface IssueOutcome {
  stage: IssueStage;
  report: {
    score: number;
    threshold: number;
    rounds: number | null;
    firstScore?: number;
  } | null;
  reworked: boolean;
}

export const REFUSAL_REASONS = [
  'below-threshold',
  'gates-failed',
  'auto-merge-off',
] as const;

export type RefusalReason = (typeof REFUSAL_REASONS)[number];

export interface ReportMilestone {
  kind: 'report';
  at: string;
  request: { number: number; url: string };
  score: number;
  threshold: number;
  refused: boolean;
  reasons: RefusalReason[];
}

export interface NeedsSpecMilestone {
  kind: 'needs-spec';
  at: string;
  removedAt: string | null;
}

export type IssueMilestone = ReportMilestone | NeedsSpecMilestone;

export interface IssueDetail {
  gitHost: GitHostName;
  number: number;
  title: string;
  url: string;
  state: IssueState;
  labels: IssueLabel[];
  requests: ClosingRequest[];
  outcome: IssueOutcome;
  milestones: IssueMilestone[];
}

export interface CollectionFailure {
  project: string;
  name: string;
  gitHost: GitHostName | null;
  reason: string;
}

export interface CollectionStatus {
  collectedAt: string | null;
  failures: CollectionFailure[];
}

export type CollectionResponse =
  | ({ status: 'ok'; refreshSeconds: number } & CollectionStatus)
  | { status: 'unreachable'; refreshSeconds: number };

export function failureMessage({
  name,
  gitHost,
  reason,
}: Pick<CollectionFailure, 'name' | 'gitHost' | 'reason'>): string {
  const host = gitHost === null ? 'the git host' : GIT_HOST_LABELS[gitHost];
  return `Could not read ${host} for ${name}: ${reason.replace(/\.+$/, '')}.`;
}
