import {
  type DemoIssue,
  type DemoRequest,
  serenityReport,
} from './demo-items.ts';

export const AUTONOMY_MERGED = 60;

export const FIRST_ISSUE = 101;
const REQUEST_OFFSET = 100;
const OLDEST_MERGE_DAYS = 82.6;
const MERGE_SPACING_DAYS = 1.39;
const WAITS_HOURS = [2, 5, 9, 26, 3, 14];
const BELOW_SCORES = [77, 68, 58];
export const FALLING_INDEX = 51;

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

export function mergedHoursAgo(index: number): number {
  return mergeDaysAgo(index) * 24 + 1;
}

export function reviewRounds(index: number, refused: boolean): number {
  if (!refused) return 1;
  return index % 3 === 0 ? 3 : 2;
}

export function mergedIssueNumber(index: number): number {
  return FIRST_ISSUE + index;
}

export function mergeDaysAgo(index: number): number {
  return OLDEST_MERGE_DAYS - index * MERGE_SPACING_DAYS;
}

export function refusedScore(index: number): number {
  return BELOW_SCORES[Math.floor(index / 4) % BELOW_SCORES.length] ?? 68;
}

function mergedDemo(index: number): Demo {
  const number = mergedIssueNumber(index);
  const mergeDays = mergeDaysAgo(index);
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
  const below = refusedScore(index);
  const refused =
    kind === 'below' || kind === 'spec-below'
      ? serenityReport(below, index % 4 === 1 ? 1 : 2)
      : kind === 'gates'
        ? serenityReport(88, null, false)
        : undefined;
  const extra =
    kind === 'spec-below'
      ? { body: serenityReport(84, 1), lead: 0.6 }
      : index === FALLING_INDEX
        ? { body: serenityReport(85, 1), lead: 0.9 }
        : undefined;
  const request: DemoRequest = {
    number: number + REQUEST_OFFSET,
    title: `feat: Demo feature ${String(index + 1)}`,
    state: 'merged',
    closes: [number],
    checks: 'passing',
    hoursAgo: mergedHoursAgo(index),
    report: serenityReport(90, reviewRounds(index, refused !== undefined)),
    reportLead: 0.25,
    ...(refused === undefined ? {} : { refusedReport: refused }),
    ...(extra === undefined ? {} : { extraReport: extra }),
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
