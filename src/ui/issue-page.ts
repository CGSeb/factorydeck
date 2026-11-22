import {
  type FeatureDetail,
  type FeatureRole,
  type FeatureThread,
  ORCHESTRATION_ROLE,
} from '../features/types.ts';
import type { ClosingRequest, IssueDetail } from '../git-host/types.ts';
import type { ChartSegment } from './components/chart-math.ts';
import type {
  SummaryAmount,
  SummaryPullRequest,
} from './components/IssueSummary.tsx';
import type {
  TimelineStep,
  TimelineThread,
} from './components/IssueTimeline.tsx';
import type { TokenCounts } from './components/token-amount.ts';
import { roleColors } from './design/palette.ts';
import { MISSING, formatDateTime, formatDay, formatTime } from './format.ts';
import { sessionPath, sessionTitle } from './session-links.ts';

export const ORCHESTRATION_DETAIL = 'Share of the orchestrating sessions';

export function dateRange(first: string | null, last: string | null): string {
  const from = first === null ? null : formatDay(first);
  const to = last === null ? null : formatDay(last);
  if (from === null || to === null) return from ?? to ?? MISSING;
  return from === to ? from : `${from} → ${to}`;
}

export function timeRange(first: string | null, last: string | null): string {
  if (first === null || last === null) return formatDateTime(first ?? last);
  const from = formatDateTime(first);
  if (formatDay(first) !== formatDay(last)) {
    return `${from} → ${formatDateTime(last)}`;
  }
  const to = formatTime(last);
  return to === formatTime(first) ? from : `${from} → ${to}`;
}

function earliest(values: (string | null)[]): string | null {
  return values.reduce<string | null>(
    (found, value) =>
      value !== null && (found === null || value < found) ? value : found,
    null,
  );
}

function latest(values: (string | null)[]): string | null {
  return values.reduce<string | null>(
    (found, value) =>
      value !== null && (found === null || value > found) ? value : found,
    null,
  );
}

export function threadsRange(
  threads: FeatureThread[],
  format: (first: string | null, last: string | null) => string = dateRange,
): string | null {
  const first = earliest(threads.map((thread) => thread.firstAt));
  const last = latest(threads.map((thread) => thread.lastAt ?? thread.firstAt));
  if (first === null && last === null) return null;
  return format(first, last);
}

function plural(count: number, word: string): string {
  return `${String(count)} ${word}${count === 1 ? '' : 's'}`;
}

export function issueActivity(feature: FeatureDetail): string {
  const sessions = plural(feature.sessions.length, 'session');
  const range = threadsRange(feature.threads);
  return range === null ? sessions : `${range} · ${sessions}`;
}

export function threadTitle(thread: FeatureThread): string {
  const description = thread.description?.trim() ?? '';
  if (description !== '') return description;
  return sessionTitle({ title: thread.sessionTitle, id: thread.sessionId });
}

function addCounts(a: TokenCounts, b: TokenCounts): TokenCounts {
  return {
    input: a.input + b.input,
    cacheWrite: a.cacheWrite + b.cacheWrite,
    cacheRead: a.cacheRead + b.cacheRead,
    output: a.output + b.output,
  };
}

const NO_TOKENS: TokenCounts = {
  input: 0,
  cacheWrite: 0,
  cacheRead: 0,
  output: 0,
};

function sumAmounts(
  items: { tokenCounts: TokenCounts; costUsd: number | null }[],
): SummaryAmount {
  return items.reduce<SummaryAmount>(
    (sum, item) => ({
      counts: addCounts(sum.counts, item.tokenCounts),
      costUsd:
        item.costUsd === null ? sum.costUsd : (sum.costUsd ?? 0) + item.costUsd,
    }),
    { counts: NO_TOKENS, costUsd: null },
  );
}

export function issueColors(feature: FeatureDetail): Map<string, string> {
  return roleColors([
    ...feature.roles.map((role) => role.role),
    ...feature.threads.map((thread) => thread.role),
    ORCHESTRATION_ROLE,
  ]);
}

function timelineThread(
  thread: FeatureThread,
  project: string,
): TimelineThread {
  return {
    id: `${thread.sessionId}:${thread.threadId}`,
    title: threadTitle(thread),
    href: sessionPath(thread.sessionId, project),
    date: formatDateTime(thread.firstAt),
    counts: thread.tokenCounts,
    costUsd: thread.costUsd,
  };
}

export function groupThreads(threads: FeatureThread[]): FeatureThread[][] {
  const groups: FeatureThread[][] = [];
  for (const thread of threads) {
    const last = groups.at(-1);
    if (last?.[0]?.role === thread.role) last.push(thread);
    else groups.push([thread]);
  }
  return groups;
}

export function issueSteps(
  feature: FeatureDetail,
  colors: Map<string, string> = issueColors(feature),
): TimelineStep[] {
  const steps = groupThreads(feature.threads).map(
    (threads, index): TimelineStep => {
      const role = threads[0]?.role ?? '';
      const count = threads.length;
      const amount = sumAmounts(threads);
      const range = threadsRange(threads, timeRange);
      return {
        id: `step-${String(index)}`,
        role,
        color: colors.get(role) ?? '',
        title: count >= 2 ? `${role} ×${String(count)}` : role,
        detail: [`${role} · ${plural(count, 'thread')}`, range]
          .filter((part) => part !== null)
          .join(' · '),
        counts: amount.counts,
        costUsd: amount.costUsd,
        threads: threads.map((thread) =>
          timelineThread(thread, feature.project),
        ),
      };
    },
  );
  if (feature.orchestration !== null) {
    steps.push({
      id: 'orchestration',
      role: ORCHESTRATION_ROLE,
      color: colors.get(ORCHESTRATION_ROLE) ?? '',
      title: ORCHESTRATION_ROLE,
      detail: ORCHESTRATION_DETAIL,
      counts: feature.orchestration.tokenCounts,
      costUsd: feature.orchestration.costUsd,
      threads: [],
    });
  }
  return steps;
}

function allRoles(feature: FeatureDetail): FeatureRole[] {
  return feature.orchestration === null
    ? feature.roles
    : [...feature.roles, feature.orchestration];
}

export function issueTotal(feature: FeatureDetail): SummaryAmount {
  return sumAmounts(allRoles(feature));
}

export function roleSegments(
  feature: FeatureDetail,
  colors: Map<string, string> = issueColors(feature),
): ChartSegment[] {
  return allRoles(feature).map((role) => ({
    label: role.role,
    value: role.tokens,
    color: colors.get(role.role) ?? '',
    counts: role.tokenCounts,
    costUsd: role.costUsd,
  }));
}

function mainRequest(requests: ClosingRequest[]): ClosingRequest | null {
  const merged = requests.find((request) => request.state === 'merged');
  if (merged !== undefined) return merged;
  return requests.reduce<ClosingRequest | null>(
    (found, request) =>
      found === null || request.createdAt > found.createdAt ? request : found,
    null,
  );
}

export function issuePullRequest(
  detail: IssueDetail | null,
): ClosingRequest | null {
  return detail === null ? null : mainRequest(detail.requests);
}

export function summaryPullRequest(
  request: ClosingRequest | null,
): SummaryPullRequest | null {
  return request === null
    ? null
    : {
        number: request.number,
        url: request.url,
        state: request.state,
        draft: request.draft,
      };
}
