import type { AutonomyResponse } from '../stats/types.ts';
import {
  type SkillFilters,
  browserTimeZone,
  fetchJson,
  isResponse,
  queryOf,
} from './skills-api.ts';

export type LoadAutonomy = (
  filters: SkillFilters,
) => Promise<AutonomyResponse | undefined>;

export function autonomyLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  timeZone: () => string = browserTimeZone,
): LoadAutonomy {
  return async (filters) => {
    const query = queryOf(filters, timeZone());
    const body = await fetchJson(
      fetchImpl,
      `/api/stats/autonomy?${query.toString()}`,
    );
    return isResponse<AutonomyResponse>(body) ? body : undefined;
  };
}
