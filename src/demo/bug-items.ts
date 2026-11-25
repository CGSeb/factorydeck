import { type DemoIssue, type DemoRequest, fixReport } from './demo-items.ts';

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
