import type {
  OverviewResponse,
  Period,
  SeriesPoint,
  UsageOverview,
} from '../overview/types.ts';
import type { LoadOverview } from './overview-api.ts';
import { nameOf } from './project-fixtures.ts';
import { splitTokens } from './token-fixtures.ts';

const DAYS = [
  '2026-01-01',
  '2026-01-02',
  '2026-01-03',
  '2026-01-04',
  '2026-01-05',
  '2026-01-06',
  '2026-01-07',
];

function point(
  bucket: string,
  opus: number,
  sonnet: number,
  haiku: number,
): SeriesPoint {
  return {
    bucket,
    tokens: splitTokens(Math.round((opus + sonnet + haiku) * 200_000)),
    opus,
    sonnet,
    haiku,
    other: 0,
  };
}

export const weekOverview: UsageOverview = {
  hasData: true,
  bucket: 'day',
  totals: {
    costUsd: 48.27,
    unknownPriceCalls: 0,
    tokens: {
      input: 182_340,
      cacheWrite: 1_204_500,
      cacheRead: 11_036_200,
      output: 96_480,
    },
    sessions: 14,
    apiCalls: 1_327,
  },
  series: [
    point(DAYS[0] ?? '', 6.1, 1.2, 0.05),
    point(DAYS[1] ?? '', 8.4, 0.6, 0),
    point(DAYS[2] ?? '', 0, 0, 0),
    point(DAYS[3] ?? '', 3.2, 2.9, 0.12),
    point(DAYS[4] ?? '', 9.8, 1.1, 0),
    point(DAYS[5] ?? '', 5.5, 0.4, 0.03),
    point(DAYS[6] ?? '', 7.3, 1.5, 0.08),
  ],
  projects: [
    {
      project: '/home/dev/example-app',
      projectName: nameOf('/home/dev/example-app'),
      sessions: 9,
      apiCalls: 982,
      tokens: 9_102_330,
      tokenCounts: splitTokens(9_102_330),
      costUsd: 36.4,
    },
    {
      project: '/home/dev/example-lib',
      projectName: nameOf('/home/dev/example-lib'),
      sessions: 4,
      apiCalls: 301,
      tokens: 3_204_190,
      tokenCounts: splitTokens(3_204_190),
      costUsd: 11.79,
    },
    {
      project: 'unassigned',
      projectName: nameOf('unassigned'),
      sessions: 1,
      apiCalls: 44,
      tokens: 213_000,
      tokenCounts: splitTokens(213_000),
      costUsd: 0.08,
    },
  ],
  models: [
    {
      model: 'claude-opus-example',
      apiCalls: 801,
      tokens: 9_870_000,
      tokenCounts: splitTokens(9_870_000),
      costUsd: 40.3,
    },
    {
      model: 'claude-sonnet-example',
      apiCalls: 402,
      tokens: 2_402_520,
      tokenCounts: splitTokens(2_402_520),
      costUsd: 7.7,
    },
    {
      model: 'claude-haiku-example',
      apiCalls: 124,
      tokens: 247_000,
      tokenCounts: splitTokens(247_000),
      costUsd: 0.004,
    },
  ],
};

export const unknownPricesOverview: UsageOverview = {
  ...weekOverview,
  totals: { ...weekOverview.totals, unknownPriceCalls: 40, apiCalls: 1_367 },
  models: [
    ...weekOverview.models,
    {
      model: 'local-model-example',
      apiCalls: 37,
      tokens: 58_200,
      tokenCounts: splitTokens(58_200),
      costUsd: null,
    },
    {
      model: '',
      apiCalls: 3,
      tokens: 1_200,
      tokenCounts: splitTokens(1_200),
      costUsd: null,
    },
  ],
};

export const todayOverview: UsageOverview = {
  ...weekOverview,
  bucket: 'hour',
  series: Array.from({ length: 12 }, (_, hour) =>
    point(
      `2026-01-07T${String(hour).padStart(2, '0')}:00`,
      hour > 8 ? hour / 4 : 0,
      hour > 9 ? 0.3 : 0,
      0,
    ),
  ),
};

export const emptyOverview: UsageOverview = {
  hasData: false,
  bucket: 'day',
  totals: {
    costUsd: 0,
    unknownPriceCalls: 0,
    tokens: { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 },
    sessions: 0,
    apiCalls: 0,
  },
  series: [],
  projects: [],
  models: [],
};

export const UPDATED_AT = '2026-01-07T09:41:05.000Z';

export function okResponse(overview: UsageOverview): OverviewResponse {
  return {
    status: 'ok',
    sessionsFolder: '/home/dev/.claude/projects',
    updatedAt: UPDATED_AT,
    refreshSeconds: 3600,
    overview,
  };
}

export const unreachableResponse: OverviewResponse = {
  status: 'unreachable',
  refreshSeconds: 3600,
};

export function fixedLoader(
  byPeriod: (period: Period) => OverviewResponse,
): LoadOverview {
  return (period) => Promise.resolve(byPeriod(period));
}
