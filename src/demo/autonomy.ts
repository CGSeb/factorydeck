import {
  type DemoIssue,
  type DemoRequest,
  serenityReport,
} from './demo-items.ts';

export const AUTONOMY_MERGED = 60;

const FIRST_ISSUE = 101;
const REQUEST_OFFSET = 100;
const OLDEST_MERGE_DAYS = 82.6;
const MERGE_SPACING_DAYS = 1.39;
const WAITS_HOURS = [2, 5, 9, 26, 3, 14];

export type HelpKind = 'none' | 'spec' | 'below' | 'gates' | 'spec-below';

const HELP_KINDS: readonly HelpKind[] = [
  'spec',
  'below',
  'gates',
  'spec-below',
];

export function helpKind(index: number): HelpKind {
  const helped = 4 - Math.floor(index / 15);
  if (index % 5 >= helped) return 'none';
  return HELP_KINDS[index % HELP_KINDS.length] ?? 'spec';
}

interface Demo {
  issues: DemoIssue[];
  requests: DemoRequest[];
}

function mergedDemo(index: number): Demo {
  const number = FIRST_ISSUE + index;
  const mergeDays = OLDEST_MERGE_DAYS - index * MERGE_SPACING_DAYS;
  const kind = helpKind(index);
  const asked = kind === 'spec' || kind === 'spec-below';
  const waitDays = (WAITS_HOURS[index % WAITS_HOURS.length] ?? 6) / 24;
  const issue: DemoIssue = {
    number,
    title: `${String(number)} · Demo feature ${String(index + 1)}`,
    closed: true,
    labels: ['spec', 'feature'],
    daysAgo: mergeDays + 3,
    closedDaysAgo: mergeDays - 0.001,
    ...(asked
      ? {
          needsSpecAt: {
            addedDaysAgo: mergeDays + 2.5,
            removedDaysAgo: mergeDays + 2.5 - waitDays,
          },
        }
      : {}),
  };
  const refused =
    kind === 'below' || kind === 'spec-below'
      ? serenityReport(68, 1)
      : kind === 'gates'
        ? serenityReport(88, 1, false)
        : undefined;
  const request: DemoRequest = {
    number: number + REQUEST_OFFSET,
    title: `feat: Demo feature ${String(index + 1)}`,
    state: 'merged',
    closes: [number],
    checks: 'passing',
    hoursAgo: mergeDays * 24 + 1,
    report: serenityReport(90, refused === undefined ? 1 : 2),
    reportLead: 0.25,
    ...(refused === undefined ? {} : { refusedReport: refused }),
  };
  return { issues: [issue], requests: [request] };
}

function waitingIssue(number: number, daysAgo: number): DemoIssue {
  return {
    number,
    title: `${String(number)} · Demo question ${String(number)}`,
    closed: false,
    labels: ['spec', 'agent:needs-spec'],
    daysAgo,
    closedDaysAgo: daysAgo - 0.5,
    needsSpecAt: { addedDaysAgo: daysAgo - 0.5, removedDaysAgo: null },
  };
}

function answeredIssue(
  number: number,
  daysAgo: number,
  waitHours: number,
): DemoIssue {
  return {
    number,
    title: `${String(number)} · Demo answered question ${String(number)}`,
    closed: false,
    labels: ['spec', 'agent:ready'],
    daysAgo,
    closedDaysAgo: daysAgo - 1,
    needsSpecAt: {
      addedDaysAgo: daysAgo - 0.2,
      removedDaysAgo: daysAgo - 0.2 - waitHours / 24,
    },
  };
}

export function autonomyDemo(): Demo {
  const merged = Array.from({ length: AUTONOMY_MERGED }, (_, index) =>
    mergedDemo(index),
  );
  const last = FIRST_ISSUE + AUTONOMY_MERGED;
  return {
    issues: [
      ...merged.flatMap((demo) => demo.issues),
      waitingIssue(last, 3),
      waitingIssue(last + 1, 1.5),
      answeredIssue(last + 2, 24, 4),
      answeredIssue(last + 3, 15, 7),
      answeredIssue(last + 4, 9, 3),
      answeredIssue(last + 5, 5, 11),
    ],
    requests: merged.flatMap((demo) => demo.requests),
  };
}

export function autoMergeOffDemo(): Demo {
  const days = [40, 18, 4];
  return {
    issues: days.map((mergeDays, index) => ({
      number: 31 + index,
      title: `Add the demo endpoint ${String(index + 1)}`,
      closed: true,
      labels: ['backend'],
      daysAgo: mergeDays + 2,
      closedDaysAgo: mergeDays - 0.001,
    })),
    requests: days.map((mergeDays, index) => ({
      number: 13 + index,
      title: `Add the demo endpoint ${String(index + 1)}`,
      state: 'merged',
      closes: [31 + index],
      checks: 'passing',
      hoursAgo: mergeDays * 24 + 1,
      report: serenityReport(92, 1),
      reportLead: 0.25,
    })),
  };
}
