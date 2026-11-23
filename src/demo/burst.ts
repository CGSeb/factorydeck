import {
  type DemoIssue,
  type DemoRequest,
  serenityReport,
} from './demo-items.ts';

export const BURST_FIRST_ISSUE = 181;
export const BURST_DAY_MERGES = 5;
export const BURST_DAY_DAYS_AGO = 3;
export const BURST_HOUR_MERGES = 3;

const HOUR = 3_600_000;
const MINUTE = 60_000;
const REQUEST_OFFSET = 300;
const DAY_SPACING_MINUTES = 6;

interface BurstMerge {
  mergedHoursAgo: number;
  refused: string | undefined;
}

function burstItems(index: number, merge: BurstMerge) {
  const number = BURST_FIRST_ISSUE + index;
  const mergeDays = merge.mergedHoursAgo / 24;
  const issue: DemoIssue = {
    number,
    title: `${String(number)} · Demo quick fix ${String(index + 1)}`,
    closed: true,
    labels: ['spec', 'feature'],
    daysAgo: mergeDays + 1,
    closedDaysAgo: Math.max(0, mergeDays - 0.0001),
  };
  const request: DemoRequest = {
    number: number + REQUEST_OFFSET,
    title: `fix: Demo quick fix ${String(index + 1)}`,
    state: 'merged',
    closes: [number],
    checks: 'passing',
    hoursAgo: merge.mergedHoursAgo + 1,
    report: serenityReport(92, merge.refused === undefined ? 1 : 2),
    reportLead: 0.1,
    ...(merge.refused === undefined ? {} : { refusedReport: merge.refused }),
  };
  return { issue, request };
}

export function burstDemo(now: Date): {
  issues: DemoIssue[];
  requests: DemoRequest[];
} {
  const sinceHour = now.getTime() % HOUR;
  const dayMerges: BurstMerge[] = Array.from(
    { length: BURST_DAY_MERGES },
    (_, index) => ({
      mergedHoursAgo:
        BURST_DAY_DAYS_AGO * 24 +
        (sinceHour - index * DAY_SPACING_MINUTES * MINUTE) / HOUR,
      refused: index === 2 ? serenityReport(86, 1, false) : undefined,
    }),
  );
  const hourMerges: BurstMerge[] = Array.from(
    { length: BURST_HOUR_MERGES },
    (_, index) => ({
      mergedHoursAgo:
        (sinceHour * (index + 1)) / (BURST_HOUR_MERGES + 1) / HOUR,
      refused: index === 1 ? serenityReport(72, 1) : undefined,
    }),
  );
  const items = [...dayMerges, ...hourMerges].map((merge, index) =>
    burstItems(index, merge),
  );
  return {
    issues: items.map((item) => item.issue),
    requests: items.map((item) => item.request),
  };
}
