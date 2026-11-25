import { type DemoIssue, type DemoRequest, fixReport } from './demo-items.ts';
import type { FakeGitHostData } from './fake-git-host.ts';

const HOUR = 3_600_000;

export const BUG_ISSUES: DemoIssue[] = [
  {
    number: 41,
    title: '041 · Export ignores the filter',
    closed: true,
    labels: ['bug'],
    daysAgo: 3,
    closedDaysAgo: 45 / 24,
  },
  {
    number: 42,
    title: '042 · Export button does nothing',
    closed: false,
    labels: ['bug', 'agent:ready'],
    daysAgo: 3,
  },
  {
    number: 43,
    title: '043 · Duplicate toast',
    closed: true,
    labels: ['bug'],
    daysAgo: 6,
    closedDaysAgo: 2,
  },
  {
    number: 44,
    title: '044 · Chart legend overlaps',
    closed: false,
    labels: ['bug', 'agent:review'],
    daysAgo: 2,
  },
  {
    number: 47,
    title: '047 · Upload stalls at 99%',
    closed: false,
    labels: ['bug', 'agent:ready'],
    daysAgo: 6,
  },
  {
    number: 49,
    title: '049 · Session expires early',
    closed: false,
    labels: ['bug', 'agent:working'],
    daysAgo: 8,
  },
];

export const BUG_REQUESTS: DemoRequest[] = [
  {
    number: 45,
    title: 'fix: Export ignores the filter',
    state: 'merged',
    closes: [41],
    checks: 'passing',
    hoursAgo: 46,
    report: fixReport(
      88,
      'The export reads the unfiltered rows.',
      'failed on main',
    ),
  },
  {
    number: 46,
    title: 'fix: Chart legend overlaps',
    state: 'open',
    closes: [44],
    checks: 'passing',
    hoursAgo: 20,
    report: fixReport(84, 'none', 'passed on main'),
  },
];

export const REOPENED_BUG_REQUESTS: DemoRequest[] = [
  {
    number: 48,
    title: 'fix: Upload stalls at 99%',
    state: 'merged',
    closes: [47],
    checks: 'passing',
    hoursAgo: 97,
    report: fixReport(90, 'The last chunk is never sent.', 'failed on main'),
  },
  {
    number: 50,
    title: 'fix: Session expires early',
    state: 'merged',
    closes: [49],
    checks: 'passing',
    hoursAgo: 145,
    report: fixReport(86, 'The expiry uses local time.', 'failed on main'),
  },
  {
    number: 51,
    title: 'fix: Session expires early, again',
    state: 'merged',
    closes: [49],
    checks: 'passing',
    hoursAgo: 73,
    report: fixReport(83, 'The refresh resets the expiry.', 'no test'),
  },
  {
    number: 52,
    title: 'fix: Session expires early, third try',
    state: 'open',
    closes: [49],
    checks: 'pending',
    hoursAgo: 10,
    report: fixReport(81, 'A clock skew on the server.', 'failed on main'),
  },
];

const REOPENED_BUG_EVENTS: Record<number, ['closed' | 'reopened', number][]> = {
  47: [
    ['closed', 96],
    ['reopened', 30],
  ],
  49: [
    ['closed', 144],
    ['reopened', 120],
    ['closed', 72],
    ['reopened', 20],
  ],
};

export function bugStateEvents(
  now: Date,
): NonNullable<FakeGitHostData['stateEvents']> {
  return Object.fromEntries(
    Object.entries(REOPENED_BUG_EVENTS).map(([number, events]) => [
      number,
      events.map(([state, hoursAgo]) => ({
        state,
        at: new Date(now.getTime() - hoursAgo * HOUR).toISOString(),
      })),
    ]),
  );
}
