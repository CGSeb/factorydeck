import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { projectOf } from './project-param.ts';
import { DEFAULT_PERIOD, type Period, isPeriod } from '../overview/types.ts';
import type { SkillListResponse, SkillResponse } from '../skills/types.ts';

export interface SkillFilters {
  period: Period;
  project: string | undefined;
}

export type LoadSkills = (
  filters: SkillFilters,
) => Promise<SkillListResponse | undefined>;

export type LoadSkill = (
  skill: string,
  filters: SkillFilters,
) => Promise<SkillResponse | undefined>;

const RETRY_SECONDS = 10;

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function isResponse<T>(body: unknown): body is T {
  return (
    typeof body === 'object' &&
    body !== null &&
    'status' in body &&
    (body.status === 'ok' || body.status === 'unreachable')
  );
}

export async function fetchJson(
  fetchImpl: typeof fetch,
  url: string,
): Promise<unknown> {
  try {
    const response = await fetchImpl(url);
    const body: unknown = await response.json();
    return body;
  } catch {
    return undefined;
  }
}

export function queryOf(
  { period, project }: SkillFilters,
  timeZone: string,
): URLSearchParams {
  const query = new URLSearchParams({ period, tz: timeZone });
  if (project !== undefined) query.set('project', project);
  return query;
}

export function skillsLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  timeZone: () => string = browserTimeZone,
): LoadSkills {
  return async (filters) => {
    const query = queryOf(filters, timeZone());
    const body = await fetchJson(fetchImpl, `/api/skills?${query.toString()}`);
    return isResponse<SkillListResponse>(body) ? body : undefined;
  };
}

export function skillLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  timeZone: () => string = browserTimeZone,
): LoadSkill {
  return async (skill, filters) => {
    const query = queryOf(filters, timeZone());
    const body = await fetchJson(
      fetchImpl,
      `/api/skills/${encodeURIComponent(skill)}?${query.toString()}`,
    );
    return isResponse<SkillResponse>(body) ? body : undefined;
  };
}

export function skillPath(skill: string, search = ''): string {
  return `/skills/${encodeURIComponent(skill)}${search}`;
}

export function useSkillFilters(): [
  SkillFilters,
  (next: SkillFilters) => void,
  string,
] {
  const [searchParams, setSearchParams] = useSearchParams();
  const period = searchParams.get('period');
  const filters: SkillFilters = {
    period: isPeriod(period) ? period : DEFAULT_PERIOD,
    project: projectOf(searchParams),
  };
  const paramsOf = (next: SkillFilters): URLSearchParams => {
    const params = new URLSearchParams({ period: next.period });
    if (next.project !== undefined) params.set('project', next.project);
    return params;
  };
  return [
    filters,
    (next) => setSearchParams(paramsOf(next)),
    `?${paramsOf(filters).toString()}`,
  ];
}

export function useRefreshing<T extends { refreshSeconds: number }>(
  key: string,
  load: () => Promise<T | undefined>,
): T | undefined {
  const [loaded, setLoaded] = useState<{ key: string; response: T }>();

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function refresh(): Promise<void> {
      const next = await load();
      if (!active) return;
      if (next !== undefined) setLoaded({ key, response: next });
      timer = setTimeout(
        () => void refresh(),
        (next?.refreshSeconds ?? RETRY_SECONDS) * 1000,
      );
    }
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key]);

  return loaded?.key === key ? loaded.response : undefined;
}
