import { useSearchParams } from 'react-router';

export const PROJECT_PARAM = 'project';

export function projectOf(params: URLSearchParams): string | undefined {
  return params.get(PROJECT_PARAM) || undefined;
}

export function useProject(): string | undefined {
  const [params] = useSearchParams();
  return projectOf(params);
}

export function withProject(path: string, project: string | undefined): string {
  if (project === undefined) return path;
  const params = new URLSearchParams({ [PROJECT_PARAM]: project });
  return `${path}?${params.toString()}`;
}

const DETAIL_LISTS: readonly { detail: RegExp; list: string }[] = [
  { detail: /^\/sessions\/[^/]+\/?$/, list: '/sessions' },
  { detail: /^\/features\/[^/]+\/?$/, list: '/features' },
  { detail: /^\/bugs\/[^/]+\/?$/, list: '/bugs' },
];

export function projectTarget(
  { pathname, search }: { pathname: string; search: string },
  project: string | undefined,
): string {
  const current = new URLSearchParams(search);
  const list = DETAIL_LISTS.find(({ detail }) => detail.test(pathname))?.list;
  const params = list === undefined ? current : new URLSearchParams();
  if (list !== undefined) {
    const period = current.get('period');
    if (period !== null) params.set('period', period);
  }
  if (project === undefined) params.delete(PROJECT_PARAM);
  else params.set(PROJECT_PARAM, project);
  const query = params.toString();
  return `${list ?? pathname}${query === '' ? '' : `?${query}`}`;
}
