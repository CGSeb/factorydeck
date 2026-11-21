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

export interface IssueRecord {
  number: number;
  title: string;
  state: IssueState;
  labels: IssueLabel[];
  url: string;
  createdAt: string;
  closedAt: string | null;
  updatedAt: string;
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

export interface IssueDetail {
  gitHost: GitHostName;
  number: number;
  title: string;
  url: string;
  state: IssueState;
  labels: IssueLabel[];
  requests: ClosingRequest[];
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
