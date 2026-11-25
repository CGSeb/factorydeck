import { autonomyDemo } from './autonomy.ts';
import { BUG_ISSUES, BUG_REQUESTS } from './bug-items.ts';
import { burstDemo } from './burst.ts';
import { qualityDemo } from './quality.ts';
import {
  type DemoIssue,
  type DemoRequest,
  serenityReport,
} from './demo-items.ts';
import type { FakeGitHostData } from './fake-git-host.ts';

export type Row = Record<string, unknown>;

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

const GITHUB_REPOSITORY = 'example-org/example-app';

export function reportComments(now: Date, request: DemoRequest): Row[] {
  const comment = (body: string, hoursAgo: number): Row => ({
    author: { login: 'factory-bot' },
    body,
    createdAt: ago(now, hoursAgo * HOUR),
  });
  return [
    ...(request.refusedReport === undefined
      ? []
      : [comment(request.refusedReport, request.hoursAgo - 0.5)]),
    ...(request.report === undefined
      ? []
      : [
          comment(
            request.report,
            request.hoursAgo - 1 + (request.reportLead ?? 0),
          ),
        ]),
    ...(request.extraReport === undefined
      ? []
      : [
          comment(
            request.extraReport.body,
            request.hoursAgo - request.extraReport.lead,
          ),
        ]),
  ];
}

function labelEvent(now: Date, added: boolean, daysAgo: number): Row {
  return {
    __typename: added ? 'LabeledEvent' : 'UnlabeledEvent',
    createdAt: ago(now, daysAgo * DAY),
    label: { name: 'agent:needs-spec' },
  };
}

function needsSpecEvents(now: Date, issue: DemoIssue): Row[] {
  const at = issue.needsSpecAt;
  if (at !== undefined) {
    return [
      labelEvent(now, true, at.addedDaysAgo),
      ...(at.removedDaysAgo === null
        ? []
        : [labelEvent(now, false, at.removedDaysAgo)]),
    ];
  }
  if (issue.needsSpec !== true) return [];
  return [
    {
      __typename: 'LabeledEvent',
      createdAt: ago(now, (issue.daysAgo - 0.5) * DAY),
      label: { name: 'agent:needs-spec' },
    },
    {
      __typename: 'UnlabeledEvent',
      createdAt: ago(now, (issue.daysAgo - 0.75) * DAY),
      label: { name: 'agent:needs-spec' },
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

export function ago(now: Date, ms: number): string {
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
    closedAt: issue.closed ? ago(now, closedDaysAgo(issue) * DAY) : null,
    updatedAt: ago(now, closedDaysAgo(issue) * DAY),
  };
}

export function closedDaysAgo(issue: DemoIssue): number {
  return issue.closedDaysAgo ?? issue.daysAgo - 1;
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
  {
    number: 24,
    title: '024 · Saved filters',
    closed: true,
    labels: ['spec', 'feature'],
    daysAgo: 4.5,
  },
  {
    number: 25,
    title: '025 · Column picker',
    closed: true,
    labels: ['spec', 'feature'],
    daysAgo: 4,
    needsSpec: true,
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
  {
    number: 26,
    title: 'feat: Saved filters',
    state: 'merged',
    closes: [24],
    checks: 'passing',
    hoursAgo: 90,
    refusedReport: serenityReport(68, 2),
    report: serenityReport(87, 3),
  },
  {
    number: 27,
    title: 'feat: Column picker',
    state: 'merged',
    closes: [25],
    checks: 'passing',
    hoursAgo: 75,
    report: serenityReport(90, 1),
  },
];

export function demoGitHub(now: Date): FakeGitHostData {
  const autonomy = autonomyDemo();
  const quality = qualityDemo();
  const burst = burstDemo(now);
  const issues = [
    ...GITHUB_ISSUES,
    ...BUG_ISSUES,
    ...autonomy.issues,
    ...quality.issues,
    ...burst.issues,
  ];
  const requests = [
    ...GITHUB_REQUESTS,
    ...BUG_REQUESTS,
    ...autonomy.requests,
    ...quality.requests,
    ...burst.requests,
  ];
  return {
    host: 'github',
    repository: GITHUB_REPOSITORY,
    issues: issues.map((issue) => githubIssueRow(now, issue)),
    requests: requests.map((request) => githubRequestRow(now, request)),
    reopened: quality.reopened,
    labelEvents: Object.fromEntries(
      issues.map((issue) => [
        String(issue.number),
        needsSpecEvents(now, issue),
      ]),
    ),
  };
}
