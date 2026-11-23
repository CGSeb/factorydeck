import { AUTONOMY_MERGED, FIRST_ISSUE, mergedHoursAgo } from './autonomy.ts';
import {
  type DemoIssue,
  type DemoRequest,
  serenityReport,
} from './demo-items.ts';

const FIRST_CLOSED = FIRST_ISSUE + AUTONOMY_MERGED + 10;
const CLOSED_DAYS_AGO = [76, 59, 41, 24, 6];
const REWORKED_BY_REQUEST = [22, 47];
export const REOPENED_INDEXES = [33, 56];

function closedIssue(daysAgo: number, index: number): DemoIssue {
  const number = FIRST_CLOSED + index;
  return {
    number,
    title: `${String(number)} · Demo dropped feature ${String(index + 1)}`,
    closed: true,
    labels: ['spec', 'feature'],
    daysAgo: daysAgo + 4,
    closedDaysAgo: daysAgo,
  };
}

function abandonedRequest(index: number, offset: number): DemoRequest {
  const issue = FIRST_ISSUE + index;
  return {
    number: issue + 200 + offset,
    title: `feat: Demo feature ${String(index + 1)}, first try`,
    state: 'closed',
    closes: [issue],
    checks: 'failing',
    hoursAgo: mergedHoursAgo(index) + 30,
    report: serenityReport(64, 1),
  };
}

export function qualityDemo(): {
  issues: DemoIssue[];
  requests: DemoRequest[];
  reopened: number[];
} {
  return {
    issues: CLOSED_DAYS_AGO.map(closedIssue),
    requests: REWORKED_BY_REQUEST.map(abandonedRequest),
    reopened: REOPENED_INDEXES.map((index) => FIRST_ISSUE + index),
  };
}
