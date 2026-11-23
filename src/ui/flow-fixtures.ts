import type {
  FlowIssue,
  FlowResponse,
  FlowStats,
  FlowStripIssue,
  FlowTokens,
  FlowWeek,
} from '../stats/types.ts';
import type { LoadFlow } from './stats-api.ts';
import { risingWeeks } from './stats-fixtures.ts';

const HOUR = 3_600_000;

const PROJECT = '/work/example-app';

const ISSUE_TITLES = [
  'Fold status groups',
  'Add period pills',
  'Show serenity reports',
  'Count unassigned work',
  'Link sessions to issues',
];

export function flowIssues(
  rows: readonly (readonly [number, number | null, number | null])[],
): FlowStripIssue[] {
  return rows.map(([leadHours, cycleHours, tokens], index) => ({
    project: PROJECT,
    number: 41 + index,
    title: index === 3 ? '' : (ISSUE_TITLES[index % ISSUE_TITLES.length] ?? ''),
    leadMs: leadHours * HOUR,
    cycleMs: cycleHours === null ? null : cycleHours * HOUR,
    tokens,
  }));
}

export const monthFlowIssues = flowIssues([
  [20, null, null],
  [26, 10, 1_000_000],
  [30, 12, 1_050_000],
  [34, 14, 1_100_000],
  [40, 16, 1_150_000],
  [44, 18, 1_200_000],
  [50, 20, 1_250_000],
  [60, 24, 1_300_000],
  [72, 30, 1_350_000],
  [130, 90, 9_600_000],
]);

export const previousFlowIssues: FlowIssue[] = [
  30, 40, 50, 60, 70, 80, 90, 100,
].map((leadHours, index) => ({
  leadMs: leadHours * HOUR,
  cycleMs: (12 + index * 4) * HOUR,
  tokens: 1_500_000,
}));

export const monthTokens: FlowTokens = {
  total: 40_000_000,
  droppedWork: 2_000_000,
  noWorkItem: 6_000_000,
  inputSide: 38_000_000,
  cacheRead: 30_400_000,
  apiCalls: 1_200,
};

export const previousMonthTokens: FlowTokens = {
  total: 32_000_000,
  droppedWork: 3_200_000,
  noWorkItem: 3_840_000,
  inputSide: 30_000_000,
  cacheRead: 21_000_000,
  apiCalls: 900,
};

export const noTokens: FlowTokens = {
  total: 0,
  droppedWork: 0,
  noWorkItem: 0,
  inputSide: 0,
  cacheRead: 0,
  apiCalls: 0,
};

export const flowWeeks: FlowWeek[] = risingWeeks.map(({ start, merged }) => ({
  start,
  merged,
}));

export function flowOf(overrides: Partial<FlowStats> = {}): FlowStats {
  return {
    current: { issues: monthFlowIssues, tokens: monthTokens },
    previous: { issues: previousFlowIssues, tokens: previousMonthTokens },
    weeks: flowWeeks,
    ...overrides,
  };
}

export function flowResponse(flow: FlowStats): FlowResponse {
  return {
    status: 'ok',
    updatedAt: '2026-11-23T09:00:00.000Z',
    refreshSeconds: 3600,
    flow,
  };
}

export function flowLoaderOf(flow: FlowStats = flowOf()): LoadFlow {
  return () => Promise.resolve(flowResponse(flow));
}

export const unreachableFlow: LoadFlow = () =>
  Promise.resolve({ status: 'unreachable', refreshSeconds: 3600 });

export const pendingFlow: LoadFlow = () => new Promise(() => undefined);
