import type { Period } from '../overview/types.ts';
import type {
  SessionListResponse,
  SessionResponse,
  SessionState,
} from '../sessions/types.ts';

export interface SessionFilters {
  period: Period;
  project: string | undefined;
  state: SessionState | undefined;
}

export type LoadSessions = (
  filters: SessionFilters,
  limit: number,
) => Promise<SessionListResponse | undefined>;

export type LoadSession = (id: string) => Promise<SessionResponse | undefined>;

function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function hasStatus(body: unknown, statuses: readonly string[]): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    'status' in body &&
    typeof body.status === 'string' &&
    statuses.includes(body.status)
  );
}

function isListResponse(body: unknown): body is SessionListResponse {
  return hasStatus(body, ['ok', 'unreachable']);
}

function isSessionResponse(body: unknown): body is SessionResponse {
  return hasStatus(body, ['ok', 'not-found', 'unreachable']);
}

async function fetchJson(
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

export function sessionsLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  timeZone: () => string = browserTimeZone,
): LoadSessions {
  return async ({ period, project, state }, limit) => {
    const query = new URLSearchParams({ period, tz: timeZone() });
    if (project !== undefined) query.set('project', project);
    if (state !== undefined) query.set('state', state);
    query.set('limit', String(limit));
    const body = await fetchJson(
      fetchImpl,
      `/api/sessions?${query.toString()}`,
    );
    return isListResponse(body) ? body : undefined;
  };
}

export function sessionLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): LoadSession {
  return async (id) => {
    const body = await fetchJson(
      fetchImpl,
      `/api/sessions/${encodeURIComponent(id)}`,
    );
    return isSessionResponse(body) ? body : undefined;
  };
}
