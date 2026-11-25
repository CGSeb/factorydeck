import { type ReactElement, useState } from 'react';
import { Link } from 'react-router';
import {
  BUG_GROUPS,
  type BugGroup,
  type BugList,
  type BugRow,
} from '../bugs/types.ts';
import {
  DataTable,
  type GroupMarker,
  GroupHeaderRow,
  NUMERIC_CELL,
} from './components/DataTable.tsx';
import { PageHeader } from './components/PageHeader.tsx';
import { PeriodPills } from './components/PeriodPills.tsx';
import { ProjectTag } from './components/ProjectTag.tsx';
import { ShowMore } from './components/ShowMore.tsx';
import { StageBadge } from './components/StageBadge.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { TokenAmount } from './components/TokenAmount.tsx';
import { projectColors } from './design/palette.ts';
import type { LoadBugs } from './bugs-api.ts';
import {
  BUG_GROUP_LABELS,
  BUG_PAGE_ROWS,
  NO_BUG_TEXT,
  NO_BUG_TICKETS_TEXT,
  ageText,
  bugSummary,
} from './bugs-view.ts';
import { featurePath } from './features-api.ts';
import { ReproducedValue } from './FixBlock.tsx';
import { SerenityCell } from './IssueGroupsTable.tsx';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import {
  type SkillFilters,
  useRefreshing,
  useSkillFilters,
} from './skills-api.ts';
import { useNow } from './use-now.ts';
import './features-page.css';
import './bugs-page.css';

export interface BugsPageProps {
  loadBugs: LoadBugs;
  now?: Date;
}

const MARKERS: Record<BugGroup, GroupMarker> = {
  open: { stage: 'ready' },
  fixing: { stage: 'working' },
  fixed: { stage: 'merged' },
};

function ReproducedCell({ row }: { row: BugRow }): ReactElement {
  return (
    <td>
      <ReproducedValue fix={row.fix} />
    </td>
  );
}

function BugTableHead({ showProject }: { showProject: boolean }): ReactElement {
  return (
    <thead>
      <tr>
        <th scope="col">Bug</th>
        {showProject && <th scope="col">Project</th>}
        <th scope="col">Stage</th>
        <th scope="col">Age</th>
        <th scope="col">Reproduced</th>
        <th scope="col" className={NUMERIC_CELL}>
          Serenity
        </th>
        <th scope="col" className={NUMERIC_CELL}>
          Tokens
        </th>
      </tr>
    </thead>
  );
}

interface RowContext {
  filters: SkillFilters;
  group: BugGroup;
  now: Date;
  projectColor: (project: string) => string | undefined;
}

function BugTableRow({
  row,
  context,
}: {
  row: BugRow;
  context: RowContext;
}): ReactElement {
  const color = context.projectColor(row.project);
  return (
    <tr>
      <th scope="row">
        <Link
          className="fd-issue-link"
          to={featurePath({ ...row, kind: 'bug' }, context.filters)}
        >
          {row.title} <span className="fd-issue-number">(#{row.number})</span>
          {row.version.number > 1 && (
            <>
              {' '}
              <span className="fd-bug-version" aria-hidden="true">
                v{row.version.number}
              </span>
              <span className="fd-visually-hidden">
                Version {row.version.number}
              </span>
            </>
          )}
        </Link>
      </th>
      {color !== undefined && (
        <td>
          <ProjectTag
            project={row.project}
            name={row.projectName}
            color={color}
          />
        </td>
      )}
      <td>
        <StageBadge stage={row.stage} />
      </td>
      <td className="fd-bugs-age">
        {ageText(row, context.group, context.now)}
      </td>
      <ReproducedCell row={row} />
      <SerenityCell
        report={
          row.score === null || row.threshold === null
            ? null
            : { score: row.score, threshold: row.threshold }
        }
      />
      <td className={NUMERIC_CELL}>
        <TokenAmount counts={row.tokenCounts} costUsd={row.costUsd} />
      </td>
    </tr>
  );
}

function BugGroupRows({
  rows,
  columns,
  context,
}: {
  rows: readonly BugRow[];
  columns: number;
  context: RowContext;
}): ReactElement {
  const [shown, setShown] = useState(BUG_PAGE_ROWS);
  const visible = rows.slice(0, shown);
  return (
    <tbody>
      <GroupHeaderRow
        name={BUG_GROUP_LABELS[context.group]}
        count={rows.length}
        colSpan={columns}
        marker={MARKERS[context.group]}
      />
      {visible.map((row) => (
        <BugTableRow
          key={`${row.project} ${String(row.number)}`}
          row={row}
          context={context}
        />
      ))}
      {rows.length > shown && (
        <tr className="fd-bugs-more">
          <td colSpan={columns}>
            <ShowMore
              shown={visible.length}
              total={rows.length}
              onShowMore={() => {
                setShown((current) => current + BUG_PAGE_ROWS);
              }}
            />
          </td>
        </tr>
      )}
    </tbody>
  );
}

function BugsTable({
  list,
  filters,
  now,
}: {
  list: BugList;
  filters: SkillFilters;
  now: Date;
}): ReactElement {
  const showProject = filters.project === undefined;
  const colors = projectColors(list.projects.map(({ project }) => project));
  const columns = showProject ? 7 : 6;
  const projectColor = (project: string): string | undefined =>
    showProject ? (colors.get(project) ?? 'var(--fd-muted)') : undefined;
  return (
    <DataTable label="Bugs">
      <table className="fd-features-table fd-bugs-table">
        <BugTableHead showProject={showProject} />
        {BUG_GROUPS.filter((group) => list.groups[group].length > 0).map(
          (group) => (
            <BugGroupRows
              key={`${group} ${filters.period} ${filters.project ?? ''}`}
              rows={list.groups[group]}
              columns={columns}
              context={{ filters, group, now, projectColor }}
            />
          ),
        )}
      </table>
    </DataTable>
  );
}

function BugsBody({
  list,
  filters,
  now,
}: {
  list: BugList;
  filters: SkillFilters;
  now: Date;
}): ReactElement {
  if (!list.bugTickets) return <StatusLine>{NO_BUG_TICKETS_TEXT}</StatusLine>;
  if (BUG_GROUPS.every((group) => list.groups[group].length === 0)) {
    return <StatusLine>{NO_BUG_TEXT}</StatusLine>;
  }
  return <BugsTable list={list} filters={filters} now={now} />;
}

export function BugsPage({
  loadBugs,
  now: fixedNow,
}: BugsPageProps): ReactElement {
  const [filters, setFilters] = useSkillFilters();
  const now = useNow(fixedNow);
  const response = useRefreshing(
    JSON.stringify(filters),
    () => loadBugs(filters),
    'bugs',
  );
  const list = response?.status === 'ok' ? response.list : undefined;
  return (
    <div className="fd-features">
      <PageHeader
        title="Bugs"
        summary={
          list === undefined || !list.bugTickets
            ? undefined
            : bugSummary(list.counts)
        }
        pending={response === undefined || list?.bugTickets === false}
        slot={
          <PeriodPills
            value={filters.period}
            onChange={(period) => {
              setFilters({ ...filters, period });
            }}
          />
        }
      />
      {response === undefined ? (
        <StatusLine>Loading…</StatusLine>
      ) : list === undefined ? (
        <StatusLine>{UNREACHABLE_MESSAGE}</StatusLine>
      ) : (
        <BugsBody list={list} filters={filters} now={now} />
      )}
    </div>
  );
}
