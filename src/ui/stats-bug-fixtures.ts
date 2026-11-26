import type {
  BugBucket,
  BugCounts,
  BugResponse,
  BugStats,
  BugStripIssue,
} from '../stats/types.ts';
import type { LoadBugStats } from './stats-api.ts';
import { risingWeeks } from './stats-fixtures.ts';

const HOUR = 3_600_000;

const PROJECT = '/work/example-app';

const BUG_TITLES = [
  'Crash on empty list',
  'Wrong total after filter',
  'Stale period after reload',
  'Missing label on chart',
  'Broken link in sidebar',
  'Timeout on large export',
];

export function bugIssues(hours: readonly number[]): BugStripIssue[] {
  return hours.map((fixHours, index) => ({
    project: PROJECT,
    number: 61 + index,
    title: BUG_TITLES[index % BUG_TITLES.length] ?? '',
    fixMs: fixHours * HOUR,
  }));
}

export const monthBugIssues = bugIssues([5, 9, 14, 20, 30, 52]);

export const monthBugs: BugCounts = {
  merged: 24,
  bugs: 6,
  reopened: 1,
  fixMs: monthBugIssues.map((issue) => issue.fixMs).sort((a, b) => a - b),
  openings: { created: 15, reopened: 5 },
};

export const previousMonthBugs: BugCounts = {
  merged: 20,
  bugs: 8,
  reopened: 2,
  fixMs: [6, 10, 18, 24, 30, 40, 48, 60].map((hours) => hours * HOUR),
  openings: { created: 14, reopened: 2 },
};

const BUGS_PER_WEEK = [2, 1, 2, 2, 1, 2, 1, 2, 1, 1, 1, 0];
const OPENED_PER_WEEK = [3, 0, 1, 4, 1, 2, 0, 3, 2, 1, 2, 1];

export const bugWeeks: BugBucket[] = risingWeeks.map(
  ({ start, merged }, index) => ({
    start,
    merged,
    bugs: Math.min(merged, BUGS_PER_WEEK[index] ?? 0),
    opened: OPENED_PER_WEEK[index] ?? 0,
  }),
);

export function bugStatsOf(overrides: Partial<BugStats> = {}): BugStats {
  return {
    current: monthBugs,
    previous: previousMonthBugs,
    issues: monthBugIssues,
    unit: 'week',
    buckets: bugWeeks,
    bugTickets: true,
    kinds: { feature: monthBugs.merged - monthBugs.bugs, bug: monthBugs.bugs },
    ...overrides,
  };
}

const fewBugIssues = bugIssues([4, 12, 26, 40]);

export const fewBugStats: BugStats = bugStatsOf({
  current: {
    merged: 24,
    bugs: 4,
    reopened: 1,
    fixMs: fewBugIssues.map((issue) => issue.fixMs),
    openings: { created: 3, reopened: 1 },
  },
  issues: fewBugIssues,
  kinds: { feature: 20, bug: 4 },
});

const NO_OPENING = { created: 0, reopened: 0 };

export const noBugTickets: BugStats = bugStatsOf({
  current: {
    merged: 24,
    bugs: 0,
    reopened: 0,
    fixMs: [],
    openings: NO_OPENING,
  },
  previous: {
    merged: 20,
    bugs: 0,
    reopened: 0,
    fixMs: [],
    openings: NO_OPENING,
  },
  issues: [],
  buckets: bugWeeks.map((bucket) => ({ ...bucket, bugs: 0, opened: 0 })),
  bugTickets: false,
  kinds: { feature: 24, bug: 0 },
});

export const openedNoFixStats: BugStats = bugStatsOf({
  current: {
    merged: 24,
    bugs: 0,
    reopened: 0,
    fixMs: [],
    openings: { created: 3, reopened: 1 },
  },
  previous: {
    merged: 20,
    bugs: 0,
    reopened: 0,
    fixMs: [],
    openings: { created: 2, reopened: 0 },
  },
  issues: [],
  buckets: bugWeeks.map((bucket, index) => ({
    ...bucket,
    bugs: 0,
    opened: index === 9 ? 3 : index === 11 ? 1 : 0,
  })),
  kinds: { feature: 24, bug: 0 },
});

export const quietBugStats: BugStats = bugStatsOf({
  current: { merged: 0, bugs: 0, reopened: 0, fixMs: [], openings: NO_OPENING },
  previous: {
    merged: 0,
    bugs: 0,
    reopened: 0,
    fixMs: [],
    openings: NO_OPENING,
  },
  issues: [],
  buckets: bugWeeks.map((bucket) => ({
    ...bucket,
    merged: 0,
    bugs: 0,
    opened: 0,
  })),
  kinds: { feature: 0, bug: 0 },
});

export function bugStatsResponse(bugs: BugStats): BugResponse {
  return {
    status: 'ok',
    updatedAt: '2026-11-23T09:00:00.000Z',
    refreshSeconds: 3600,
    bugs,
  };
}

export function bugStatsLoaderOf(bugs: BugStats = noBugTickets): LoadBugStats {
  return () => Promise.resolve(bugStatsResponse(bugs));
}

export const unreachableBugStats: LoadBugStats = () =>
  Promise.resolve({ status: 'unreachable', refreshSeconds: 3600 });
