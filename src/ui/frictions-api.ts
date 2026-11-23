import { useSearchParams } from 'react-router';
import {
  type FrictionKind,
  type FrictionsResponse,
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

export interface FrictionFilters {
  period: Period;
  project: string | undefined;
  kind: FrictionKind | undefined;
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
    if (filters.kind !== undefined) query.set(KIND_PARAM, filters.kind);
    const body = await fetchJson(
      fetchImpl,
      `/api/frictions?${query.toString()}`,
    );
    return isResponse<FrictionsResponse>(body) ? body : undefined;
  };
}

export function frictionFiltersOf(params: URLSearchParams): FrictionFilters {
  const period = params.get('period');
  return {
    period: isPeriod(period) ? period : DEFAULT_PERIOD,
    project: projectOf(params),
    kind: parseKind(params.get(KIND_PARAM)),
  };
}

export function frictionParams(filters: FrictionFilters): URLSearchParams {
  const params = new URLSearchParams({ period: filters.period });
  if (filters.project !== undefined) params.set(PROJECT_PARAM, filters.project);
  if (filters.kind !== undefined) params.set(KIND_PARAM, filters.kind);
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
