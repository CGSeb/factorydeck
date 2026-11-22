import type {
  FeatureListResponse,
  FeatureResponse,
  FeatureRow,
} from '../features/types.ts';
import {
  type SkillFilters,
  browserTimeZone,
  fetchJson,
  queryOf,
} from './skills-api.ts';

export const SORT_KEYS = [
  'cost',
  'tokens',
  'sessions',
  'score',
  'rounds',
  'number',
] as const;

export type SortKey = (typeof SORT_KEYS)[number];

export interface FeatureSort {
  key: SortKey;
  order: 'asc' | 'desc';
}

export const DEFAULT_SORT: FeatureSort = { key: 'cost', order: 'desc' };

export type LoadFeatures = (
  filters: SkillFilters,
) => Promise<FeatureListResponse | undefined>;

export type LoadFeature = (
  key: { project: string; number: number },
  filters: SkillFilters,
) => Promise<FeatureResponse | undefined>;

function hasStatus(body: unknown, statuses: readonly string[]): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    'status' in body &&
    typeof body.status === 'string' &&
    statuses.includes(body.status)
  );
}

function isListResponse(body: unknown): body is FeatureListResponse {
  return hasStatus(body, ['ok', 'unreachable']);
}

function isFeatureResponse(body: unknown): body is FeatureResponse {
  return hasStatus(body, ['ok', 'not-found', 'unreachable']);
}

export function featuresLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  timeZone: () => string = browserTimeZone,
): LoadFeatures {
  return async (filters) => {
    const query = queryOf(filters, timeZone());
    const body = await fetchJson(
      fetchImpl,
      `/api/features?${query.toString()}`,
    );
    return isListResponse(body) ? body : undefined;
  };
}

export function featureLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  timeZone: () => string = browserTimeZone,
): LoadFeature {
  return async ({ project, number }, { period }) => {
    const query = queryOf({ period, project }, timeZone());
    const body = await fetchJson(
      fetchImpl,
      `/api/features/${String(number)}?${query.toString()}`,
    );
    return isFeatureResponse(body) ? body : undefined;
  };
}

export function featurePath(
  { project, number }: { project: string; number: number },
  { period }: Pick<SkillFilters, 'period'>,
): string {
  const params = new URLSearchParams({ project, period });
  return `/features/${String(number)}?${params.toString()}`;
}

export function featuresPath(filters: SkillFilters): string {
  const params = new URLSearchParams({ period: filters.period });
  if (filters.project !== undefined) params.set('project', filters.project);
  return `/features?${params.toString()}`;
}

export function nextSort(current: FeatureSort, key: SortKey): FeatureSort {
  return current.key === key && current.order === 'asc'
    ? { key, order: 'desc' }
    : { key, order: 'asc' };
}

const VALUES: Record<SortKey, (row: FeatureRow) => number | null> = {
  cost: (row) => row.costUsd,
  tokens: (row) => row.tokens,
  sessions: (row) => row.sessions,
  score: (row) => row.outcome?.report?.score ?? null,
  rounds: (row) => row.outcome?.report?.rounds ?? null,
  number: (row) => row.number,
};

export function sortFeatures(
  rows: readonly FeatureRow[],
  { key, order }: FeatureSort,
): FeatureRow[] {
  const sign = order === 'asc' ? 1 : -1;
  return [...rows].sort((left, right) => {
    const a = VALUES[key](left);
    const b = VALUES[key](right);
    if (a === null || b === null) {
      return a === b ? 0 : a === null ? 1 : -1;
    }
    return (a - b) * sign;
  });
}
