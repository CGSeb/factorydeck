import { useSearchParams } from 'react-router';
import {
  type FrictionKind,
  type FrictionsResponse,
  frictionFilterOf,
  parseKind,
} from '../frictions/types.ts';
import { DEFAULT_PERIOD, type Period, isPeriod } from '../overview/types.ts';
import { PROJECT_PARAM, projectOf } from './project-param.ts';
import {
  browserTimeZone,
  fetchJson,
  isResponse,
  queryOf,
} from './skills-api.ts';

export const KIND_PARAM = 'kind';
export const SESSION_PARAM = 'session';
export const ISSUE_PARAM = 'issue';

export interface FrictionFilters {
  period: Period;
  project: string | undefined;
  kind: FrictionKind | undefined;
  session?: string | undefined;
  issue?: number | undefined;
}

function filterEntries(filters: FrictionFilters): [string, string][] {
  const entries: [string, string][] = [];
  if (filters.kind !== undefined) entries.push([KIND_PARAM, filters.kind]);
  if (filters.session !== undefined) {
    entries.push([SESSION_PARAM, filters.session]);
  } else if (filters.issue !== undefined && filters.project !== undefined) {
    entries.push([ISSUE_PARAM, String(filters.issue)]);
  }
  return entries;
}

export type LoadFrictions = (
  filters: FrictionFilters,
) => Promise<FrictionsResponse | undefined>;

export function frictionsLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  timeZone: () => string = browserTimeZone,
): LoadFrictions {
  return async (filters) => {
    const query = queryOf(filters, timeZone());
    for (const [key, value] of filterEntries(filters)) query.set(key, value);
    const body = await fetchJson(
      fetchImpl,
      `/api/frictions?${query.toString()}`,
    );
    return isResponse<FrictionsResponse>(body) ? body : undefined;
  };
}

export function frictionFiltersOf(params: URLSearchParams): FrictionFilters {
  const period = params.get('period');
  const project = projectOf(params);
  const filter = frictionFilterOf({
    session: params.get(SESSION_PARAM),
    issue: params.get(ISSUE_PARAM),
    project,
  });
  return {
    period: isPeriod(period) ? period : DEFAULT_PERIOD,
    project,
    kind: parseKind(params.get(KIND_PARAM)),
    session: filter?.session,
    issue: filter?.issue,
  };
}

export function frictionParams(filters: FrictionFilters): URLSearchParams {
  const params = new URLSearchParams({ period: filters.period });
  if (filters.project !== undefined) params.set(PROJECT_PARAM, filters.project);
  for (const [key, value] of filterEntries(filters)) params.set(key, value);
  return params;
}

export function useFrictionFilters(): [
  FrictionFilters,
  (next: FrictionFilters) => void,
] {
  const [searchParams, setSearchParams] = useSearchParams();
  return [
    frictionFiltersOf(searchParams),
    (next) => setSearchParams(frictionParams(next)),
  ];
}

export function withoutFilter(filters: FrictionFilters): FrictionFilters {
  return { ...filters, session: undefined, issue: undefined };
}

export function frictionsHref(
  filters: Partial<FrictionFilters> & { period: Period },
): string {
  return `/frictions?${frictionParams({
    project: undefined,
    kind: undefined,
    ...filters,
  }).toString()}`;
}
