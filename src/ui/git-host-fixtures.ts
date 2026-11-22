import type {
  CollectionFailure,
  CollectionResponse,
  IssueDetail,
} from '../git-host/types.ts';
import type { LoadCollection, RefreshCollection } from './git-host-api.ts';

const HOUR = 3_600_000;

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * HOUR).toISOString();
}

export const githubIssue: IssueDetail = {
  gitHost: 'github',
  number: 52,
  title: 'Export button',
  url: 'https://github.com/example-org/example-app/issues/52',
  state: 'open',
  labels: [
    { name: 'agent:review', color: '#5319e7' },
    { name: 'bug', color: '#d73a4a' },
    { name: 'good first issue', color: '#7057ff' },
    { name: 'help wanted', color: '#008672' },
    { name: 'spec', color: '#fbca04' },
    { name: 'triage', color: null },
  ],
  requests: [
    {
      number: 58,
      title: 'feat: Export button',
      url: 'https://github.com/example-org/example-app/pull/58',
      state: 'open',
      draft: true,
      checks: 'pending',
      createdAt: hoursAgo(2),
    },
    {
      number: 55,
      title: 'feat: Export button, second try',
      url: 'https://github.com/example-org/example-app/pull/55',
      state: 'open',
      draft: false,
      checks: 'failing',
      createdAt: hoursAgo(20),
    },
    {
      number: 54,
      title: 'feat: Export button, first try',
      url: 'https://github.com/example-org/example-app/pull/54',
      state: 'closed',
      draft: false,
      checks: 'none',
      createdAt: hoursAgo(30),
    },
    {
      number: 53,
      title: 'feat: Export data model',
      url: 'https://github.com/example-org/example-app/pull/53',
      state: 'merged',
      draft: false,
      checks: 'passing',
      createdAt: hoursAgo(40),
    },
  ],
};

export const gitlabIssue: IssueDetail = {
  gitHost: 'gitlab',
  number: 21,
  title: 'Add the refunds endpoint',
  url: 'https://gitlab.com/example-group/example-api/-/issues/21',
  state: 'closed',
  labels: [
    { name: 'backend', color: '#428bca' },
    { name: 'priority::high', color: '#dc143c' },
  ],
  requests: [
    {
      number: 12,
      title: 'Add the refunds endpoint',
      url: 'https://gitlab.com/example-group/example-api/-/merge_requests/12',
      state: 'merged',
      draft: false,
      checks: 'passing',
      createdAt: hoursAgo(5),
    },
  ],
};

export const issueWithoutRequests: IssueDetail = {
  ...githubIssue,
  number: 61,
  title: 'Keyboard shortcuts',
  url: 'https://github.com/example-org/example-app/issues/61',
  labels: [],
  requests: [],
};

export const appFailure: CollectionFailure = {
  project: '/home/dev/example-app',
  name: 'example-app',
  gitHost: 'github',
  reason: 'gh not found',
};

export const apiFailure: CollectionFailure = {
  project: '/home/dev/example-api',
  name: 'example-api',
  gitHost: 'gitlab',
  reason: 'glab: 401 Unauthorized',
};

export function collectionResponse(
  collectedAt: string | null = hoursAgo(0.05),
  failures: CollectionFailure[] = [],
): CollectionResponse {
  return { status: 'ok', refreshSeconds: 3600, collectedAt, failures };
}

export function collectionLoaderOf(
  response: CollectionResponse,
): LoadCollection {
  return () => Promise.resolve(response);
}

export function refresherOf(response: CollectionResponse): RefreshCollection {
  return () => Promise.resolve(response);
}

export function pendingRefresher(): RefreshCollection {
  return () => new Promise<CollectionResponse | undefined>(() => undefined);
}
