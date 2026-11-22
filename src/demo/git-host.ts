import type { FakeGitHostData } from './fake-git-host.ts';

type Row = Record<string, unknown>;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const GITHUB_REPOSITORY = 'example-org/example-app';
const GITLAB_PROJECT = 'example-group/example-api';

interface DemoIssue {
  number: number;
  title: string;
  closed: boolean;
  labels: string[];
  daysAgo: number;
}

interface DemoRequest {
  number: number;
  title: string;
  state: 'open' | 'merged' | 'closed';
  closes: number[];
  checks: string;
  hoursAgo: number;
  draft?: boolean;
  report?: string;
}

function serenityReport(score: number, rounds: number): string {
  return [
    `## Serenity: ${String(score)}/100 (threshold 80)`,
    '',
    '- −10: a demo deduction',
    '',
    `Gates: all passed. Review: ${String(rounds)} ${rounds === 1 ? 'round' : 'rounds'}, confidence high.`,
  ].join('\n');
}

function reportComments(now: Date, request: DemoRequest): Row[] {
  if (request.report === undefined) return [];
  return [
    {
      author: { login: 'factory-bot' },
      body: request.report,
      createdAt: ago(now, (request.hoursAgo - 1) * HOUR),
    },
  ];
}

const GITHUB_COLORS: Record<string, string> = {
  feature: 'a2eeef',
  spec: '1d76db',
  'agent:review': '5319e7',
  'agent:ready': 'fbca04',
  'agent:blocked': 'b60205',
  bug: 'd73a4a',
};

const GITHUB_ROLLUPS: Record<string, Row[]> = {
  passing: [{ status: 'COMPLETED', conclusion: 'SUCCESS' }],
  failing: [
    { status: 'COMPLETED', conclusion: 'FAILURE' },
    { __typename: 'StatusContext', state: 'SUCCESS' },
  ],
  pending: [{ status: 'IN_PROGRESS', conclusion: '' }],
  none: [],
};

function ago(now: Date, ms: number): string {
  return new Date(now.getTime() - ms).toISOString();
}

function githubIssueRow(now: Date, issue: DemoIssue): Row {
  return {
    number: issue.number,
    title: issue.title,
    state: issue.closed ? 'CLOSED' : 'OPEN',
    labels: issue.labels.map((name) => ({ name, color: GITHUB_COLORS[name] })),
    url: `https://github.com/${GITHUB_REPOSITORY}/issues/${String(issue.number)}`,
    createdAt: ago(now, issue.daysAgo * DAY),
    closedAt: issue.closed ? ago(now, (issue.daysAgo - 1) * DAY) : null,
    updatedAt: ago(now, (issue.daysAgo - 1) * DAY),
  };
}

function githubRequestRow(now: Date, request: DemoRequest): Row {
  const done = ago(now, (request.hoursAgo - 1) * HOUR);
  return {
    number: request.number,
    title: request.title,
    state: request.state.toUpperCase(),
    isDraft: request.draft === true,
    headRefName: `feat/${String(request.closes[0] ?? request.number)}-demo`,
    url: `https://github.com/${GITHUB_REPOSITORY}/pull/${String(request.number)}`,
    createdAt: ago(now, request.hoursAgo * HOUR),
    mergedAt: request.state === 'merged' ? done : null,
    closedAt: request.state === 'open' ? null : done,
    updatedAt: done,
    closingIssuesReferences: request.closes.map((number) => ({
      number,
      repository: { name: 'example-app', owner: { login: 'example-org' } },
    })),
    statusCheckRollup: GITHUB_ROLLUPS[request.checks] ?? [],
    comments: reportComments(now, request),
  };
}

const GITHUB_ISSUES: DemoIssue[] = [
  {
    number: 11,
    title: '011 · Export button',
    closed: true,
    labels: ['spec', 'feature'],
    daysAgo: 10,
  },
  {
    number: 12,
    title: '012 · Export menu',
    closed: false,
    labels: ['spec', 'agent:review', 'feature'],
    daysAgo: 8,
  },
  {
    number: 13,
    title: '013 · CSV columns',
    closed: false,
    labels: ['spec', 'agent:ready'],
    daysAgo: 6,
  },
  {
    number: 14,
    title: '014 · Empty state',
    closed: false,
    labels: ['bug', 'agent:blocked'],
    daysAgo: 5,
  },
  {
    number: 15,
    title: '015 · Keyboard shortcuts',
    closed: false,
    labels: [],
    daysAgo: 4,
  },
];

const GITHUB_REQUESTS: DemoRequest[] = [
  {
    number: 17,
    title: 'feat: Export button',
    state: 'merged',
    closes: [11],
    checks: 'passing',
    hoursAgo: 200,
    report: serenityReport(86, 1),
  },
  {
    number: 18,
    title: 'feat: Export menu, first try',
    state: 'closed',
    closes: [12],
    checks: 'failing',
    hoursAgo: 150,
  },
  {
    number: 19,
    title: 'feat: Export menu',
    state: 'open',
    closes: [12],
    checks: 'failing',
    hoursAgo: 30,
    report: serenityReport(72, 2),
  },
  {
    number: 20,
    title: 'feat: CSV columns',
    state: 'open',
    closes: [13],
    checks: 'pending',
    hoursAgo: 5,
    draft: true,
  },
  {
    number: 21,
    title: 'fix: Empty state',
    state: 'open',
    closes: [14],
    checks: 'none',
    hoursAgo: 3,
  },
];

export function demoGitHub(now: Date): FakeGitHostData {
  return {
    host: 'github',
    repository: GITHUB_REPOSITORY,
    issues: GITHUB_ISSUES.map((issue) => githubIssueRow(now, issue)),
    requests: GITHUB_REQUESTS.map((request) => githubRequestRow(now, request)),
  };
}

const GITLAB_PIPELINES: Record<string, string | null> = {
  passing: 'success',
  failing: 'failed',
  pending: 'running',
  none: null,
};

function gitlabIssueRow(now: Date, issue: DemoIssue): Row {
  return {
    iid: issue.number,
    project_id: 7,
    title: issue.title,
    state: issue.closed ? 'closed' : 'opened',
    labels: issue.labels,
    web_url: `https://gitlab.com/${GITLAB_PROJECT}/-/issues/${String(issue.number)}`,
    created_at: ago(now, issue.daysAgo * DAY),
    closed_at: issue.closed ? ago(now, (issue.daysAgo - 1) * DAY) : null,
    updated_at: ago(now, (issue.daysAgo - 1) * DAY),
  };
}

function gitlabRequestRow(now: Date, request: DemoRequest): Row {
  const done = ago(now, (request.hoursAgo - 1) * HOUR);
  const pipeline = GITLAB_PIPELINES[request.checks] ?? null;
  return {
    iid: request.number,
    project_id: 7,
    target_project_id: 7,
    title: request.title,
    state: request.state === 'open' ? 'opened' : request.state,
    draft: request.draft === true,
    source_branch: `fix/${String(request.closes[0] ?? request.number)}-endpoint`,
    web_url: `https://gitlab.com/${GITLAB_PROJECT}/-/merge_requests/${String(request.number)}`,
    created_at: ago(now, request.hoursAgo * HOUR),
    merged_at: request.state === 'merged' ? done : null,
    closed_at: request.state === 'closed' ? done : null,
    updated_at: done,
    head_pipeline: pipeline === null ? null : { status: pipeline },
  };
}

const GITLAB_REQUESTS: DemoRequest[] = [
  {
    number: 3,
    title: 'Add the orders endpoint',
    state: 'merged',
    closes: [21],
    checks: 'passing',
    hoursAgo: 160,
    report: serenityReport(64, 3),
  },
  {
    number: 4,
    title: 'Add the refunds endpoint',
    state: 'open',
    closes: [22],
    checks: 'pending',
    hoursAgo: 20,
  },
];

export function demoGitLab(now: Date): FakeGitHostData {
  return {
    host: 'gitlab',
    repository: GITLAB_PROJECT,
    labels: [
      { name: 'backend', color: '#428bca' },
      { name: 'priority::high', color: '#dc143c' },
      { name: 'triage', color: '' },
    ],
    issues: [
      {
        number: 21,
        title: 'Add the orders endpoint',
        closed: true,
        labels: ['backend'],
        daysAgo: 9,
      },
      {
        number: 22,
        title: 'Add the refunds endpoint',
        closed: false,
        labels: ['priority::high', 'backend', 'triage'],
        daysAgo: 4,
      },
    ].map((issue) => gitlabIssueRow(now, issue)),
    requests: GITLAB_REQUESTS.map((request) => gitlabRequestRow(now, request)),
    notes: Object.fromEntries(
      GITLAB_REQUESTS.map((request) => [
        String(request.number),
        [
          {
            body: 'added 1 commit',
            system: true,
            created_at: ago(now, request.hoursAgo * HOUR),
          },
          ...reportComments(now, request).map((comment) => ({
            body: comment['body'],
            system: false,
            created_at: comment['createdAt'],
          })),
        ],
      ]),
    ),
    reopened: [22],
    closes: Object.fromEntries(
      GITLAB_REQUESTS.map((request) => [
        String(request.number),
        request.closes.map((iid) => ({ iid, project_id: 7 })),
      ]),
    ),
  };
}
