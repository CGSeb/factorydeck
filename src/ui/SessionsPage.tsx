import { type ReactElement, useState } from 'react';
import { Link } from 'react-router';
import type { WorkItemIssue } from '../git-host/types.ts';
import {
  SESSION_PAGE_SIZE,
  type SessionList,
  type StateCounts,
  type SessionSummary,
} from '../sessions/types.ts';
import { DataTable, NUMERIC_CELL } from './components/DataTable.tsx';
import { FilterPills } from './components/FilterPills.tsx';
import { PageHeader } from './components/PageHeader.tsx';
import { Panel } from './components/Panel.tsx';
import { PeriodPills } from './components/PeriodPills.tsx';
import { ProjectTag } from './components/ProjectTag.tsx';
import { SessionStateBadge } from './components/SessionStateBadge.tsx';
import { ShowMore } from './components/ShowMore.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { TokenAmount } from './components/TokenAmount.tsx';
import { projectColors } from './design/palette.ts';
import { MISSING, formatAgo, formatDuration } from './format.ts';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import {
  type LinkScope,
  issueHref,
  sessionHref,
  sessionTitle,
} from './session-links.ts';
import {
  ALL,
  sessionCountText,
  stateOptions,
  useFilters,
  useSessionList,
} from './session-list.ts';
import { canShowMore, nextLimit } from './session-paging.ts';
import type { LoadSessions, SessionFilters } from './sessions-api.ts';
import './sessions.css';

export interface SessionsPageProps {
  loadSessions: LoadSessions;
}

export function IssueNumberLink({
  workItem,
  issue,
  project,
  scope,
}: {
  workItem: number | null;
  issue: WorkItemIssue | null;
  project: string;
  scope: Pick<LinkScope, 'period'>;
}): ReactElement {
  if (workItem === null) return <>{MISSING}</>;
  return (
    <Link
      to={issueHref(workItem, project, scope)}
      title={issue?.status === 'found' ? issue.title : undefined}
    >
      #{workItem}
    </Link>
  );
}

interface RowContext {
  filters: SessionFilters;
  colors: Map<string, string>;
  now: Date;
}

function SessionRow({
  row,
  filters,
  colors,
  now,
}: RowContext & { row: SessionSummary }): ReactElement {
  const scope = { project: filters.project, period: filters.period };
  return (
    <tr>
      <td>
        <SessionStateBadge state={row.state} />
      </td>
      <th scope="row">
        <Link to={sessionHref(row.id, scope)}>{sessionTitle(row)}</Link>
      </th>
      {filters.project === undefined && (
        <td>
          <ProjectTag
            project={row.project}
            name={row.projectName}
            color={colors.get(row.project) ?? 'var(--fd-muted)'}
          />
        </td>
      )}
      <td className="fd-session-mono">
        {row.gitBranch === '' ? MISSING : row.gitBranch}
      </td>
      <td>
        <IssueNumberLink
          workItem={row.workItem}
          issue={row.issue}
          project={row.project}
          scope={scope}
        />
      </td>
      <td className={NUMERIC_CELL}>{formatAgo(row.lastAt, now)}</td>
      <td className={NUMERIC_CELL}>
        {formatDuration(row.firstAt, row.lastAt)}
      </td>
      <td className={NUMERIC_CELL}>
        <TokenAmount counts={row.tokenCounts} costUsd={row.costUsd} />
      </td>
    </tr>
  );
}

function SessionsTable({
  sessions,
  ...context
}: RowContext & { sessions: SessionSummary[] }): ReactElement {
  return (
    <DataTable label="Sessions">
      <table className="fd-session-list-table">
        <thead>
          <tr>
            <th scope="col">State</th>
            <th scope="col">Title</th>
            {context.filters.project === undefined && (
              <th scope="col">Project</th>
            )}
            <th scope="col">Branch</th>
            <th scope="col">Work item</th>
            <th scope="col" className={NUMERIC_CELL}>
              Last activity
            </th>
            <th scope="col" className={NUMERIC_CELL}>
              Duration
            </th>
            <th scope="col" className={NUMERIC_CELL}>
              Tokens
            </th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((row) => (
            <SessionRow key={row.id} row={row} {...context} />
          ))}
        </tbody>
      </table>
    </DataTable>
  );
}

function SessionRows({
  list,
  filters,
  onMore,
}: {
  list: SessionList;
  filters: SessionFilters;
  onMore: () => void;
}): ReactElement {
  return (
    <>
      {list.sessions.length === 0 ? (
        <StatusLine>No sessions match these filters.</StatusLine>
      ) : (
        <Panel>
          <SessionsTable
            sessions={list.sessions}
            filters={filters}
            colors={projectColors(list.projects.map((row) => row.project))}
            now={new Date()}
          />
        </Panel>
      )}
      {canShowMore(list.sessions.length, list.total) && (
        <ShowMore
          shown={list.sessions.length}
          total={list.total}
          onShowMore={onMore}
        />
      )}
    </>
  );
}

function StatePills({
  counts,
  filters,
  onFilters,
}: {
  counts: StateCounts;
  filters: SessionFilters;
  onFilters: (next: SessionFilters) => void;
}): ReactElement {
  return (
    <FilterPills
      label="State"
      options={stateOptions(counts)}
      value={filters.state ?? ALL}
      onChange={(choice) =>
        onFilters({ ...filters, state: choice === ALL ? undefined : choice })
      }
    />
  );
}

export function SessionsPage({
  loadSessions,
}: SessionsPageProps): ReactElement {
  const [filters, setFilters] = useFilters();
  const filterKey = JSON.stringify(filters);
  const [shown, setShown] = useState({ filterKey, limit: SESSION_PAGE_SIZE });
  const limit = shown.filterKey === filterKey ? shown.limit : SESSION_PAGE_SIZE;
  const { response, counts } = useSessionList(loadSessions, filters, limit);
  const list = response?.status === 'ok' ? response.list : undefined;

  return (
    <div className="fd-sessions">
      <PageHeader
        title="Sessions"
        summary={list === undefined ? undefined : sessionCountText(list.total)}
        slot={
          <PeriodPills
            value={filters.period}
            onChange={(period) => setFilters({ ...filters, period })}
          />
        }
      />
      {counts !== undefined && (
        <StatePills counts={counts} filters={filters} onFilters={setFilters} />
      )}
      {response === undefined && <StatusLine>Loading…</StatusLine>}
      {response?.status === 'unreachable' && (
        <StatusLine>{UNREACHABLE_MESSAGE}</StatusLine>
      )}
      {list !== undefined && (
        <SessionRows
          list={list}
          filters={filters}
          onMore={() => setShown({ filterKey, limit: nextLimit(limit) })}
        />
      )}
    </div>
  );
}
