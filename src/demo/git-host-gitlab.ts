import {
  DAY,
  HOUR,
  type Row,
  ago,
  closedDaysAgo,
  reportComments,
} from './git-host.ts';
import {
  type DemoIssue,
  type DemoRequest,
  serenityReport,
} from './demo-items.ts';
import { FACTORY_WORKFLOW, type FakeGitHostData } from './fake-git-host.ts';

const GITLAB_PROJECT = 'example-group/example-api';

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
    closed_at: issue.closed ? ago(now, closedDaysAgo(issue) * DAY) : null,
    updated_at: ago(now, closedDaysAgo(issue) * DAY),
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
    factory: FACTORY_WORKFLOW.replace('auto_merge: true', 'auto_merge: false'),
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
