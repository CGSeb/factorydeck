import type {
  BugFix,
  BugList,
  BugListResponse,
  BugRow,
} from '../bugs/types.ts';
import type { LoadBugs } from './bugs-api.ts';
import { APP, LIB } from './feature-fixtures.ts';
import { nameOf, optionsOf } from './project-fixtures.ts';
import { splitTokens } from './token-fixtures.ts';

export function fixRequest(number: number): BugFix['request'] {
  return {
    number,
    url: `https://github.com/example-org/example-app/pull/${String(number)}`,
  };
}

export const BUGS_NOW = new Date('2026-03-12T15:30:00Z');

const HOUR = 3_600_000;

function hoursAgo(hours: number): string {
  return new Date(BUGS_NOW.getTime() - hours * HOUR).toISOString();
}

export function bugRow(
  number: number,
  title: string,
  extra: Partial<BugRow> = {},
): BugRow {
  const project = extra.project ?? APP;
  const tokens = extra.tokens ?? 0;
  const createdAt = extra.createdAt ?? hoursAgo(30);
  return {
    project,
    projectName: nameOf(project),
    number,
    title,
    url: `https://github.com/example-org/example-app/issues/${String(number)}`,
    stage: 'open',
    createdAt,
    version: { number: 1, count: 1, startedAt: createdAt },
    mergedAt: null,
    closedAt: null,
    fix: null,
    score: null,
    threshold: null,
    lastAt: null,
    tokens,
    tokenCounts: splitTokens(tokens),
    costUsd: tokens === 0 ? 0 : tokens / 1_000_000,
    ...extra,
  };
}

export const openBugs: BugRow[] = [
  bugRow(72, 'Export drops the last row', {
    stage: 'blocked',
    createdAt: hoursAgo(76),
  }),
  bugRow(75, 'Wrong total on the invoice', {
    stage: 'ready',
    project: LIB,
    createdAt: hoursAgo(3.1),
  }),
];

export const fixingBugs: BugRow[] = [
  bugRow(77, 'Login loops on refresh', {
    stage: 'in-review',
    createdAt: hoursAgo(20),
    fix: {
      rootCause: 'A stale token',
      reproduced: 'passed-on-main',
      request: fixRequest(101),
    },
    score: 72,
    threshold: 80,
    lastAt: hoursAgo(1),
    tokens: 1_850_000,
  }),
  bugRow(76, 'Search ignores accents', {
    stage: 'working',
    createdAt: hoursAgo(10),
    lastAt: hoursAgo(2),
    tokens: 640_000,
  }),
];

export const fixedBugs: BugRow[] = [
  bugRow(70, 'Empty state shows twice', {
    stage: 'merged',
    createdAt: hoursAgo(50),
    mergedAt: hoursAgo(2),
    fix: {
      rootCause: 'A duplicated render',
      reproduced: 'failed-on-main',
      request: fixRequest(102),
    },
    score: 91,
    threshold: 80,
    lastAt: hoursAgo(2.5),
    tokens: 2_400_000,
  }),
  bugRow(69, 'Date shifts by one day', {
    stage: 'merged-after-person',
    createdAt: hoursAgo(80),
    mergedAt: hoursAgo(5),
    fix: {
      rootCause: null,
      reproduced: 'did-not-run-on-main',
      request: fixRequest(103),
    },
    score: 84,
    threshold: 80,
    tokens: 1_200_000,
  }),
  bugRow(68, 'Sort order lost on reload', {
    stage: 'merged-by-person',
    createdAt: hoursAgo(100),
    mergedAt: hoursAgo(26),
    fix: {
      rootCause: 'The sort is not in the URL',
      reproduced: 'no-test',
      request: fixRequest(104),
    },
    score: 62,
    threshold: 80,
    tokens: 900_000,
  }),
  bugRow(67, 'Tooltip cut off', {
    stage: 'merged',
    createdAt: hoursAgo(60),
    mergedAt: hoursAgo(40),
    fix: { rootCause: null, reproduced: null, request: fixRequest(105) },
    score: 88,
    threshold: 80,
    tokens: 300_000,
  }),
  bugRow(66, 'Crash on an empty file', {
    stage: 'closed',
    createdAt: hoursAgo(90),
    closedAt: hoursAgo(30),
  }),
];

export function inVersion(
  row: BugRow,
  number: number,
  startedHoursAgo: number,
): BugRow {
  return {
    ...row,
    version: { number, count: number, startedAt: hoursAgo(startedHoursAgo) },
  };
}

export const reopenedOpenBug = inVersion(
  bugRow(80, 'Upload stalls at 99%', {
    stage: 'open',
    createdAt: hoursAgo(120),
  }),
  2,
  5,
);

export const reopenedFixedBug = inVersion(
  bugRow(81, 'Totals round twice', {
    stage: 'merged',
    createdAt: hoursAgo(200),
    mergedAt: hoursAgo(3),
    fix: {
      rootCause: 'Rounding in two places',
      reproduced: 'failed-on-main',
      request: fixRequest(106),
    },
    score: 86,
    threshold: 80,
    lastAt: hoursAgo(3.5),
    tokens: 820_000,
  }),
  2,
  27,
);

export const thirdVersionBug = inVersion(
  bugRow(82, 'Session expires early', {
    stage: 'working',
    createdAt: hoursAgo(300),
    fix: {
      rootCause: 'A clock skew',
      reproduced: 'passed-on-main',
      request: fixRequest(107),
    },
    lastAt: hoursAgo(1),
    tokens: 410_000,
  }),
  3,
  8,
);

export function bugList(
  groups: Partial<BugList['groups']> = {},
  bugTickets = true,
): BugList {
  const all = {
    open: groups.open ?? [],
    fixing: groups.fixing ?? [],
    fixed: groups.fixed ?? [],
  };
  return {
    bugTickets,
    groups: all,
    counts: {
      open: all.open.length + all.fixing.length,
      fixed: all.fixed.filter((row) => row.stage.startsWith('merged')).length,
      closed: all.fixed.filter((row) => row.stage === 'closed').length,
    },
    projects: optionsOf([APP, LIB]),
  };
}

export const someBugs = bugList({
  open: openBugs,
  fixing: fixingBugs,
  fixed: fixedBugs,
});

export function bugsResponse(list: BugList): BugListResponse {
  return {
    status: 'ok',
    updatedAt: BUGS_NOW.toISOString(),
    refreshSeconds: 3600,
    list,
  };
}

export function bugsLoaderOf(list: BugList = someBugs): LoadBugs {
  return () => Promise.resolve(bugsResponse(list));
}
