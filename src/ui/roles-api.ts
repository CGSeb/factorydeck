import type { RoleListResponse } from '../roles/types.ts';
import {
  type SkillFilters,
  browserTimeZone,
  fetchJson,
  isResponse,
  queryOf,
} from './skills-api.ts';

export type LoadRoles = (
  filters: SkillFilters,
) => Promise<RoleListResponse | undefined>;

export function rolesLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  timeZone: () => string = browserTimeZone,
): LoadRoles {
  return async (filters) => {
    const query = queryOf(filters, timeZone());
    const body = await fetchJson(fetchImpl, `/api/roles?${query.toString()}`);
    return isResponse<RoleListResponse>(body) ? body : undefined;
  };
}
