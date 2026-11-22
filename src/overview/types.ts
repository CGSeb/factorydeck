export const PERIODS = ['today', '7d', '30d', 'all'] as const;

export type Period = (typeof PERIODS)[number];

export const DEFAULT_PERIOD: Period = '7d';

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

export type SeriesPoint = { bucket: string } & Record<Family, number>;

export interface ProjectUsage {
  project: string;
  projectName: string;
  sessions: number;
  apiCalls: number;
  tokens: number;
  costUsd: number | null;
}

export interface ModelUsage {
  model: string;
  apiCalls: number;
  tokens: number;
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

export type OverviewResponse =
  | {
      status: 'ok';
      sessionsFolder: string;
      updatedAt: string | null;
      refreshSeconds: number;
      overview: UsageOverview;
    }
  | { status: 'unreachable'; refreshSeconds: number };
