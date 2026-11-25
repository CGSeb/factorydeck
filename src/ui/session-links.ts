import { CODEX_AGENT } from '../sessions/types.ts';
import { type Period, isPeriod } from '../overview/types.ts';
import { PROJECT_PARAM, projectOf, withProject } from './project-param.ts';
import type { IssueKind } from '../git-host/kind.ts';
import { featurePath, issuePageBase } from './features-api.ts';
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
  kind: IssueKind | null = null,
): string {
  if (period !== undefined) {
    return featurePath({ project, number, kind }, { period });
  }
  return withQuery(`${issuePageBase(kind)}/${String(number)}`, [
    [PROJECT_PARAM, project],
  ]);
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
  agent,
}: {
  title: string;
  id: string;
  agent?: string | undefined;
}): string {
  if (title !== '') return title;
  return agent === CODEX_AGENT
    ? `Codex session ${id.slice(0, 8)}`
    : id.slice(0, 8);
}

export function sessionPath(id: string, project?: string): string {
  return withProject(`/sessions/${encodeURIComponent(id)}`, project);
}
