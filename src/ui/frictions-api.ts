import { useSearchParams } from 'react-router';
import {
  type FrictionKind,
  type FrictionsResponse,
  frictionFilterOf,
  parseKind,
  parseRole,
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
export const ROLE_PARAM = 'role';
export const SESSION_PARAM = 'session';
export const ISSUE_PARAM = 'issue';

export interface FrictionFilters {
  period: Period;
  project: string | undefined;
  kind: FrictionKind | undefined;
  role?: string | undefined;
  session?: string | undefined;
  issue?: number | undefined;
}

function filterEntries(filters: FrictionFilters): [string, string][] {
  const entries: [string, string][] = [];
  if (filters.kind !== undefined) entries.push([KIND_PARAM, filters.kind]);
  if (filters.role !== undefined) entries.push([ROLE_PARAM, filters.role]);
  if (filters.session !== undefined) {
    entries.push([SESSION_PARAM, filters.session]);
  } else if (filters.issue !== undefined && filters.project !== undefined) {
    entries.push([ISSUE_PARAM, String(filters.issue)]);
  }
  return entries;
}

export function frictionsQuery(
  filters: FrictionFilters,
  timeZone: string,
): URLSearchParams {
  const query = queryOf(filters, timeZone);
  for (const [key, value] of filterEntries(filters)) query.set(key, value);
  return query;
}

export type LoadFrictions = (
  filters: FrictionFilters,
) => Promise<FrictionsResponse | undefined>;

export function frictionsLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  timeZone: () => string = browserTimeZone,
): LoadFrictions {
  return async (filters) => {
    const body = await fetchJson(
      fetchImpl,
      `/api/frictions?${frictionsQuery(filters, timeZone()).toString()}`,
    );
    return isResponse<FrictionsResponse>(body) ? body : undefined;
  };
}

export type LoadReport = (filters: FrictionFilters) => Promise<string>;

export function frictionReportLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  timeZone: () => string = browserTimeZone,
): LoadReport {
  return async (filters) => {
    const response = await fetchImpl(
      `/api/frictions/report?${frictionsQuery(filters, timeZone()).toString()}`,
    );
    if (!response.ok) {
      throw new Error(`The report answered ${String(response.status)}`);
    }
    return response.text();
  };
}

export type WriteClipboard = (text: string) => Promise<void>;

export const writeClipboard: WriteClipboard = (text) =>
  navigator.clipboard.writeText(text);

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
    role: parseRole(params.get(ROLE_PARAM)),
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
