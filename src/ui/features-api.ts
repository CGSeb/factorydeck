import type {
  FeatureListResponse,
  FeatureResponse,
} from '../features/types.ts';
import type { IssueKind } from '../git-host/kind.ts';
import {
  type SkillFilters,
  browserTimeZone,
  fetchJson,
  queryOf,
} from './skills-api.ts';

export type LoadFeatures = (
  filters: SkillFilters,
  kind?: IssueKind | null,
) => Promise<FeatureListResponse | undefined>;

export type LoadFeature = (
  key: { project: string; number: number },
  filters: SkillFilters,
) => Promise<FeatureResponse | undefined>;

function hasStatus(body: unknown, statuses: readonly string[]): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    'status' in body &&
    typeof body.status === 'string' &&
    statuses.includes(body.status)
  );
}

function isListResponse(body: unknown): body is FeatureListResponse {
  return hasStatus(body, ['ok', 'unreachable']);
}

function isFeatureResponse(body: unknown): body is FeatureResponse {
  return hasStatus(body, ['ok', 'not-found', 'unreachable']);
}

export function featuresLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  timeZone: () => string = browserTimeZone,
): LoadFeatures {
  return async (filters, kind = null) => {
    const query = queryOf(filters, timeZone());
    if (kind !== null) query.set('kind', kind);
    const body = await fetchJson(
      fetchImpl,
      `/api/features?${query.toString()}`,
    );
    return isListResponse(body) ? body : undefined;
  };
}

export async function loadKindList(
  load: LoadFeatures,
  filters: SkillFilters,
  kind: IssueKind | null,
): Promise<FeatureListResponse | undefined> {
  const response = await load(filters, kind);
  if (kind === null || response?.status !== 'ok' || response.list.bugTickets) {
    return response;
  }
  return load(filters);
}

export function featureLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  timeZone: () => string = browserTimeZone,
): LoadFeature {
  return async ({ project, number }, { period }) => {
    const query = queryOf({ period, project }, timeZone());
    const body = await fetchJson(
      fetchImpl,
      `/api/features/${String(number)}?${query.toString()}`,
    );
    return isFeatureResponse(body) ? body : undefined;
  };
}

export function issuePageBase(kind: IssueKind | null | undefined): string {
  return kind === 'bug' ? '/bugs' : '/features';
}

export function featurePath(
  {
    project,
    number,
    kind,
  }: { project: string; number: number; kind?: IssueKind | null | undefined },
  { period }: Pick<SkillFilters, 'period'>,
): string {
  const params = new URLSearchParams({ project, period });
  return `${issuePageBase(kind)}/${String(number)}?${params.toString()}`;
}

function listPath(base: string, filters: SkillFilters): string {
  const params = new URLSearchParams({ period: filters.period });
  if (filters.project !== undefined) params.set('project', filters.project);
  return `${base}?${params.toString()}`;
}

export function featuresPath(filters: SkillFilters): string {
  return listPath('/features', filters);
}

export function bugsPath(filters: SkillFilters): string {
  return listPath('/bugs', filters);
}
