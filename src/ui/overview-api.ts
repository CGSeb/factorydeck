import type { OverviewResponse, Period } from '../overview/types.ts';

export const UNREACHABLE_MESSAGE =
  'Database unreachable. Start it with pnpm db:up.';

export type LoadOverview = (
  period: Period,
  project?: string,
) => Promise<OverviewResponse | undefined>;

function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function isOverviewResponse(body: unknown): body is OverviewResponse {
  return (
    typeof body === 'object' &&
    body !== null &&
    'status' in body &&
    (body.status === 'ok' || body.status === 'unreachable')
  );
}

export function overviewLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  timeZone: () => string = browserTimeZone,
): LoadOverview {
  return async (period, project) => {
    const query = new URLSearchParams({ period, tz: timeZone() });
    if (project !== undefined) query.set('project', project);
    try {
      const response = await fetchImpl(`/api/overview?${query.toString()}`);
      const body: unknown = await response.json();
      return isOverviewResponse(body) ? body : undefined;
    } catch {
      return undefined;
    }
  };
}
