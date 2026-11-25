import type { IssueKind } from '../git-host/kind.ts';
import type {
  AutonomyResponse,
  BugResponse,
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

type KindLoad<T> = (
  filters: SkillFilters,
  kind?: IssueKind | null,
) => Promise<T | undefined>;

function statsLoader<T>(
  path: string,
  fetchImpl: typeof fetch,
  timeZone: () => string,
): KindLoad<T> {
  return async (filters, kind = null) => {
    const query = queryOf(filters, timeZone());
    if (kind !== null) query.set('kind', kind);
    const body = await fetchJson(
      fetchImpl,
      `/api/stats/${path}?${query.toString()}`,
    );
    return isResponse<T>(body) ? body : undefined;
  };
}

export type LoadAutonomy = KindLoad<AutonomyResponse>;

export function autonomyLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  timeZone: () => string = browserTimeZone,
): LoadAutonomy {
  return statsLoader('autonomy', fetchImpl, timeZone);
}

export type LoadQuality = KindLoad<QualityResponse>;

export function qualityLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  timeZone: () => string = browserTimeZone,
): LoadQuality {
  return statsLoader('quality', fetchImpl, timeZone);
}

export type LoadFlow = KindLoad<FlowResponse>;

export function flowLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  timeZone: () => string = browserTimeZone,
): LoadFlow {
  return statsLoader('flow', fetchImpl, timeZone);
}

export type LoadBugStats = (
  filters: SkillFilters,
) => Promise<BugResponse | undefined>;

export function bugStatsLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  timeZone: () => string = browserTimeZone,
): LoadBugStats {
  const load = statsLoader<BugResponse>('bugs', fetchImpl, timeZone);
  return (filters) => load(filters);
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
