import type {
  AutonomyResponse,
  FlowResponse,
  QualityResponse,
  WaitingResponse,
} from '../stats/types.ts';
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

export type LoadQuality = (
  filters: SkillFilters,
) => Promise<QualityResponse | undefined>;

export function qualityLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  timeZone: () => string = browserTimeZone,
): LoadQuality {
  return async (filters) => {
    const query = queryOf(filters, timeZone());
    const body = await fetchJson(
      fetchImpl,
      `/api/stats/quality?${query.toString()}`,
    );
    return isResponse<QualityResponse>(body) ? body : undefined;
  };
}

export type LoadFlow = (
  filters: SkillFilters,
) => Promise<FlowResponse | undefined>;

export function flowLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  timeZone: () => string = browserTimeZone,
): LoadFlow {
  return async (filters) => {
    const query = queryOf(filters, timeZone());
    const body = await fetchJson(
      fetchImpl,
      `/api/stats/flow?${query.toString()}`,
    );
    return isResponse<FlowResponse>(body) ? body : undefined;
  };
}

export type LoadWaiting = (
  project: string | undefined,
) => Promise<WaitingResponse | undefined>;

export function waitingLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): LoadWaiting {
  return async (project) => {
    const query = new URLSearchParams();
    if (project !== undefined) query.set('project', project);
    const suffix = query.size === 0 ? '' : `?${query.toString()}`;
    const body = await fetchJson(fetchImpl, `/api/stats/waiting${suffix}`);
    return isResponse<WaitingResponse>(body) ? body : undefined;
  };
}
