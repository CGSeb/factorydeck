import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { DEFAULT_PERIOD, isPeriod } from '../overview/types.ts';
import {
  SESSION_STATES,
  type SessionListResponse,
  type SessionState,
  type StateCounts,
  isSessionState,
} from '../sessions/types.ts';
import type { FilterOption } from './components/FilterPills.tsx';
import { SESSION_STATE_BADGES } from './components/SessionStateBadge.tsx';
import { formatCount } from './format.ts';
import { projectOf } from './project-param.ts';
import type { LoadSessions, SessionFilters } from './sessions-api.ts';

const RETRY_SECONDS = 10;

export const ALL = 'all';

export type StateChoice = SessionState | typeof ALL;

export function sessionCountText(count: number): string {
  return `${formatCount(count)} ${count === 1 ? 'session' : 'sessions'}`;
}

export function stateOptions(counts: StateCounts): FilterOption<StateChoice>[] {
  const all = SESSION_STATES.reduce((sum, state) => sum + counts[state], 0);
  return [
    { value: ALL, label: 'All', count: all },
    ...SESSION_STATES.map((state) => ({
      value: state,
      label: SESSION_STATE_BADGES[state].text,
      count: counts[state],
      dot: SESSION_STATE_BADGES[state].dot,
    })),
  ];
}

export function useFilters(): [SessionFilters, (next: SessionFilters) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const period = searchParams.get('period');
  const state = searchParams.get('state');
  const filters: SessionFilters = {
    period: isPeriod(period) ? period : DEFAULT_PERIOD,
    project: projectOf(searchParams),
    state: isSessionState(state) ? state : undefined,
  };
  const update = (next: SessionFilters): void => {
    const params = new URLSearchParams({ period: next.period });
    if (next.project !== undefined) params.set('project', next.project);
    if (next.state !== undefined) params.set('state', next.state);
    setSearchParams(params);
  };
  return [filters, update];
}

export interface SessionListView {
  response: SessionListResponse | undefined;
  counts: StateCounts | undefined;
}

export function useSessionList(
  loadSessions: LoadSessions,
  { period, project, state }: SessionFilters,
  limit: number,
): SessionListView {
  const key = JSON.stringify({ period, project, state, limit });
  const [loaded, setLoaded] = useState<{
    key: string;
    response: SessionListResponse;
  }>();
  const filterKey = JSON.stringify({ period, project, state });
  const [last, setLast] = useState<{
    filterKey: string;
    response: SessionListResponse;
  }>();
  const scopeKey = JSON.stringify({ period, project });
  const [counts, setCounts] = useState<{
    scopeKey: string;
    counts: StateCounts;
  }>();

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const current: SessionFilters = { period, project, state };
    const currentFilterKey = JSON.stringify(current);
    const currentKey = JSON.stringify({ ...current, limit });
    const currentScopeKey = JSON.stringify({ period, project });
    async function refresh(): Promise<void> {
      const next = await loadSessions(current, limit);
      if (!active) return;
      if (next !== undefined) {
        setLoaded({ key: currentKey, response: next });
        setLast({ filterKey: currentFilterKey, response: next });
        if (next.status === 'ok') {
          setCounts({ scopeKey: currentScopeKey, counts: next.list.counts });
        }
      }
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
  }, [loadSessions, period, project, state, limit]);

  const response =
    loaded?.key === key
      ? loaded.response
      : last?.filterKey === filterKey
        ? last.response
        : undefined;
  return {
    response,
    counts: counts?.scopeKey === scopeKey ? counts.counts : undefined,
  };
}
