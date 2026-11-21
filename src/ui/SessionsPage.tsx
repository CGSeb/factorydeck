import { type ReactElement, useEffect, useId, useState } from 'react';
import { useSearchParams } from 'react-router';
import { DEFAULT_PERIOD, type Period, isPeriod } from '../overview/types.ts';
import {
  SESSION_PAGE_SIZE,
  SESSION_STATES,
  type SessionListResponse,
  type StateCounts,
  isSessionState,
} from '../sessions/types.ts';
import { formatClock, formatCount } from './format.ts';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import { PeriodSelector } from './PeriodSelector.tsx';
import type { LoadSessions, SessionFilters } from './sessions-api.ts';
import { STATE_LABELS } from './SessionStateLabel.tsx';
import { SessionTable } from './SessionTable.tsx';

const RETRY_SECONDS = 10;

export interface SessionsPageProps {
  loadSessions: LoadSessions;
}

function countsLine(counts: StateCounts): string {
  return [
    `${formatCount(counts.working)} working`,
    `${formatCount(counts.waiting)} waiting for you`,
    `${formatCount(counts.inactive)} inactive`,
  ].join(' · ');
}

function useFilters(): [SessionFilters, (next: SessionFilters) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const period = searchParams.get('period');
  const state = searchParams.get('state');
  const filters: SessionFilters = {
    period: isPeriod(period) ? period : DEFAULT_PERIOD,
    project: searchParams.get('project') ?? undefined,
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

function SessionsContent({
  response,
  onMore,
}: {
  response: SessionListResponse | undefined;
  onMore: () => void;
}): ReactElement {
  if (response === undefined) return <p className="status">Loading…</p>;
  if (response.status === 'unreachable') {
    return <p className="status">{UNREACHABLE_MESSAGE}</p>;
  }
  const { list } = response;
  return (
    <>
      <p className="state-counts">{countsLine(list.counts)}</p>
      {list.sessions.length === 0 ? (
        <p className="status">No sessions match these filters.</p>
      ) : (
        <section className="panel">
          <SessionTable sessions={list.sessions} now={new Date()} />
        </section>
      )}
      {list.sessions.length < list.total && (
        <button type="button" className="show-more" onClick={onMore}>
          Show more
        </button>
      )}
    </>
  );
}

function useSessionList(
  loadSessions: LoadSessions,
  { period, project, state }: SessionFilters,
  limit: number,
): SessionListResponse | undefined {
  const key = JSON.stringify({ period, project, state, limit });
  const [loaded, setLoaded] = useState<{
    key: string;
    response: SessionListResponse;
  }>();
  const [last, setLast] = useState<SessionListResponse>();

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const current: SessionFilters = { period, project, state };
    const currentKey = JSON.stringify({ ...current, limit });
    async function refresh(): Promise<void> {
      const next = await loadSessions(current, limit);
      if (!active) return;
      if (next !== undefined) {
        setLoaded({ key: currentKey, response: next });
        setLast(next);
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

  if (loaded?.key === key) return loaded.response;
  return limit > SESSION_PAGE_SIZE ? last : undefined;
}

function FilterBar({
  filters,
  projects,
  onChange,
}: {
  filters: SessionFilters;
  projects: string[];
  onChange: (next: SessionFilters) => void;
}): ReactElement {
  const projectId = useId();
  const stateId = useId();
  const { project, state } = filters;
  const options =
    project === undefined || projects.includes(project)
      ? projects
      : [...projects, project];
  return (
    <div className="filters">
      <label htmlFor={projectId}>
        Project
        <select
          id={projectId}
          value={project ?? ''}
          onChange={(event) =>
            onChange({ ...filters, project: event.target.value || undefined })
          }
        >
          <option value="">All projects</option>
          {options.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor={stateId}>
        State
        <select
          id={stateId}
          value={state ?? ''}
          onChange={(event) => {
            const value = event.target.value;
            onChange({
              ...filters,
              state: isSessionState(value) ? value : undefined,
            });
          }}
        >
          <option value="">All</option>
          {SESSION_STATES.map((name) => (
            <option key={name} value={name}>
              {STATE_LABELS[name]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function SessionsPage({
  loadSessions,
}: SessionsPageProps): ReactElement {
  const [filters, setFilters] = useFilters();
  const filterKey = JSON.stringify(filters);
  const [shown, setShown] = useState({ filterKey, limit: SESSION_PAGE_SIZE });
  const limit = shown.filterKey === filterKey ? shown.limit : SESSION_PAGE_SIZE;
  const response = useSessionList(loadSessions, filters, limit);
  const updatedAt =
    response?.status === 'ok' && response.updatedAt !== null
      ? formatClock(new Date(response.updatedAt))
      : undefined;

  return (
    <div className="sessions">
      <div className="overview-header">
        <h1>Sessions</h1>
        {updatedAt !== undefined && (
          <p className="updated">Updated {updatedAt}</p>
        )}
        <PeriodSelector
          value={filters.period}
          onChange={(period: Period) => setFilters({ ...filters, period })}
        />
      </div>
      <FilterBar
        filters={filters}
        projects={response?.status === 'ok' ? response.list.projects : []}
        onChange={setFilters}
      />
      <SessionsContent
        response={response}
        onMore={() => setShown({ filterKey, limit: limit + SESSION_PAGE_SIZE })}
      />
    </div>
  );
}
