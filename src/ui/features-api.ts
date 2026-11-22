import { useSearchParams } from 'react-router';
import type {
  FeatureListResponse,
  FeatureResponse,
  FeatureRow,
} from '../features/types.ts';
import { DEFAULT_PERIOD, isPeriod } from '../overview/types.ts';
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

function isSortKey(value: unknown): value is SortKey {
  return SORT_KEYS.some((key) => key === value);
}

export function sortOf(params: URLSearchParams): FeatureSort {
  const key = params.get('sort');
  const order = params.get('order');
  if (!isSortKey(key)) return DEFAULT_SORT;
  return { key, order: order === 'desc' ? 'desc' : 'asc' };
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

export function useFeatureParams(): {
  filters: SkillFilters;
  sort: FeatureSort;
  setFilters: (next: SkillFilters) => void;
  setSort: (next: FeatureSort) => void;
} {
  const [params, setParams] = useSearchParams();
  const period = params.get('period');
  const filters: SkillFilters = {
    period: isPeriod(period) ? period : DEFAULT_PERIOD,
    project: params.get('project') ?? undefined,
  };
  const sort = sortOf(params);
  const write = (nextFilters: SkillFilters, nextSort: FeatureSort): void => {
    const next = new URLSearchParams({ period: nextFilters.period });
    if (nextFilters.project !== undefined) {
      next.set('project', nextFilters.project);
    }
    if (
      nextSort.key !== DEFAULT_SORT.key ||
      nextSort.order !== DEFAULT_SORT.order
    ) {
      next.set('sort', nextSort.key);
      next.set('order', nextSort.order);
    }
    setParams(next);
  };
  return {
    filters,
    sort,
    setFilters: (next) => write(next, sort),
    setSort: (next) => write(filters, next),
  };
}
