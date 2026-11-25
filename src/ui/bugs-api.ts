import type { BugListResponse } from '../bugs/types.ts';
import {
  type SkillFilters,
  browserTimeZone,
  fetchJson,
  isResponse,
  queryOf,
} from './skills-api.ts';

export type LoadBugs = (
  filters: SkillFilters,
) => Promise<BugListResponse | undefined>;

export function bugsLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  timeZone: () => string = browserTimeZone,
): LoadBugs {
  return async (filters) => {
    const query = queryOf(filters, timeZone());
    const body = await fetchJson(fetchImpl, `/api/bugs?${query.toString()}`);
    return isResponse<BugListResponse>(body) ? body : undefined;
  };
}
