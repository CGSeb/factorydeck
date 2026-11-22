import { type Period, isPeriod } from '../overview/types.ts';
import { PROJECT_PARAM, projectOf, withProject } from './project-param.ts';
import { featurePath } from './features-api.ts';
import { skillPath } from './skills-api.ts';

export interface LinkScope {
  project: string | undefined;
  period: Period | undefined;
}

export function scopeOf(params: URLSearchParams): LinkScope {
  const period = params.get('period');
  return {
    project: projectOf(params),
    period: isPeriod(period) ? period : undefined,
  };
}

function withQuery(
  path: string,
  entries: readonly (readonly [string, string | undefined])[],
): string {
  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    if (value !== undefined) params.set(key, value);
  }
  const query = params.toString();
  return query === '' ? path : `${path}?${query}`;
}

export function sessionsHref({ project, period }: LinkScope): string {
  return withQuery('/sessions', [
    ['period', period],
    [PROJECT_PARAM, project],
  ]);
}

export function sessionHref(
  id: string,
  { project, period }: LinkScope,
): string {
  return withQuery(`/sessions/${encodeURIComponent(id)}`, [
    [PROJECT_PARAM, project],
    ['period', period],
  ]);
}

export function issueHref(
  number: number,
  project: string,
  { period }: Pick<LinkScope, 'period'>,
): string {
  if (period !== undefined) return featurePath({ project, number }, { period });
  return withQuery(`/features/${String(number)}`, [[PROJECT_PARAM, project]]);
}

export function skillHref(
  skill: string,
  { project, period }: LinkScope,
): string {
  return skillPath(
    skill,
    withQuery('', [
      ['period', period],
      [PROJECT_PARAM, project],
    ]),
  );
}

export function sessionTitle({
  title,
  id,
}: {
  title: string;
  id: string;
}): string {
  return title === '' ? id.slice(0, 8) : title;
}

export function sessionPath(id: string, project?: string): string {
  return withProject(`/sessions/${encodeURIComponent(id)}`, project);
}
