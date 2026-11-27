import type { IssueKind } from '../git-host/kind.ts';

export const PERIODS = ['today', '7d', '30d', 'all'] as const;

export type Period = (typeof PERIODS)[number];

export const DEFAULT_PERIOD: Period = '7d';

export const PERIOD_LABELS: Record<Period, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  all: 'All time',
};

export function isPeriod(value: unknown): value is Period {
  return PERIODS.some((period) => period === value);
}

export const FAMILIES = ['opus', 'sonnet', 'haiku', 'other'] as const;

export type Family = (typeof FAMILIES)[number];

export interface TokenCounts {
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
}

export type SeriesPoint = { bucket: string; tokens: TokenCounts } & Record<
  Family,
  number
>;

export interface ProjectUsage {
  project: string;
  projectName: string;
  sessions: number;
  apiCalls: number;
  tokens: number;
  tokenCounts: TokenCounts;
  costUsd: number | null;
}

export interface ModelUsage {
  model: string;
  apiCalls: number;
  tokens: number;
  tokenCounts: TokenCounts;
  costUsd: number | null;
}

export interface UsageOverview {
  hasData: boolean;
  bucket: 'day' | 'hour';
  totals: {
    costUsd: number;
    unknownPriceCalls: number;
    tokens: TokenCounts;
    sessions: number;
    apiCalls: number;
  };
  series: SeriesPoint[];
  projects: ProjectUsage[];
  models: ModelUsage[];
}

export interface OverviewKinds {
  merged: Record<IssueKind, number>;
  openBugs: number;
  bugTickets: boolean;
}

export type OverviewData = UsageOverview & OverviewKinds;

export type OverviewResponse =
  | {
      status: 'ok';
      sessionsFolder: string;
      updatedAt: string | null;
      refreshSeconds: number;
      overview: OverviewData;
    }
  | { status: 'unreachable'; refreshSeconds: number };
