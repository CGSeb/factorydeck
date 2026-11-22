import type { ReactElement } from 'react';
import { Link, useNavigate } from 'react-router';
import type {
  FeatureRow,
  FeatureTotals,
  FeatureUsage,
} from '../features/types.ts';
import {
  type FeatureSort,
  type SortKey,
  featurePath,
  nextSort,
  sortFeatures,
} from './features-api.ts';
import { MISSING, formatCost, formatCount } from './format.ts';
import type { SkillFilters } from './skills-api.ts';
import { StageLabel } from './StageLabel.tsx';
import { TokenCount } from './TokenCount.tsx';

export interface FeatureTableProps {
  rows: FeatureRow[];
  noWorkItem: FeatureUsage | null;
  totals: FeatureTotals;
  filters: SkillFilters;
  sort: FeatureSort;
  onSort: (sort: FeatureSort) => void;
}

export function issueText({ number, issue }: FeatureRow): string {
  const label = `#${String(number)}`;
  if (issue.status === 'found') return `${label} ${issue.title}`;
  if (issue.status === 'not-found') return `${label} (not found)`;
  return label;
}

function optional(value: number | null | undefined): string {
  return value === null || value === undefined ? MISSING : formatCount(value);
}

function SortHeader({
  label,
  column,
  sort,
  onSort,
  className,
}: {
  label: string;
  column: SortKey;
  sort: FeatureSort;
  onSort: (sort: FeatureSort) => void;
  className?: string;
}): ReactElement {
  const active = sort.key === column;
  return (
    <th
      scope="col"
      className={className}
      aria-sort={
        active ? (sort.order === 'asc' ? 'ascending' : 'descending') : undefined
      }
    >
      <button
        type="button"
        className="sort"
        onClick={() => onSort(nextSort(sort, column))}
      >
        {label}
        <span aria-hidden="true" className="sort-mark">
          {active ? (sort.order === 'asc' ? '▲' : '▼') : ''}
        </span>
      </button>
    </th>
  );
}

function FeatureTableHead({
  showProject,
  sort,
  onSort,
}: {
  showProject: boolean;
  sort: FeatureSort;
  onSort: (sort: FeatureSort) => void;
}): ReactElement {
  const header = (label: string, column: SortKey): ReactElement => (
    <SortHeader label={label} column={column} sort={sort} onSort={onSort} />
  );
  return (
    <thead>
      <tr>
        <SortHeader
          label="Issue"
          column="number"
          sort={sort}
          onSort={onSort}
          className="left"
        />
        {showProject && (
          <th scope="col" className="left">
            Project
          </th>
        )}
        <th scope="col" className="left">
          Stage
        </th>
        {header('Serenity', 'score')}
        {header('Review rounds', 'rounds')}
        {header('Sessions', 'sessions')}
        {header('Tokens', 'tokens')}
        <th scope="col">Orchestration cost</th>
        {header('Cost', 'cost')}
      </tr>
    </thead>
  );
}

function IssueRow({
  row,
  path,
  showProject,
}: {
  row: FeatureRow;
  path: string;
  showProject: boolean;
}): ReactElement {
  const navigate = useNavigate();
  return (
    <tr
      className="session-row"
      onClick={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest('a') !== null
        ) {
          return;
        }
        void navigate(path);
      }}
    >
      <th scope="row" className="left">
        <Link to={path}>{issueText(row)}</Link>
      </th>
      {showProject && <td className="left project">{row.project}</td>}
      <td className="left">
        {row.outcome === null ? (
          MISSING
        ) : (
          <StageLabel stage={row.outcome.stage} />
        )}
      </td>
      <td>{optional(row.outcome?.report?.score)}</td>
      <td>{optional(row.outcome?.report?.rounds)}</td>
      <td>{formatCount(row.sessions)}</td>
      <td>
        <TokenCount value={Math.round(row.tokens)} />
      </td>
      <td>{formatCost(row.orchestrationCostUsd)}</td>
      <td>{formatCost(row.costUsd)}</td>
    </tr>
  );
}

function NoWorkItemRow({
  usage,
  showProject,
}: {
  usage: FeatureUsage;
  showProject: boolean;
}): ReactElement {
  return (
    <tr>
      <th scope="row" className="left">
        No work item
      </th>
      {showProject && <td className="left">{MISSING}</td>}
      <td className="left">{MISSING}</td>
      <td>{MISSING}</td>
      <td>{MISSING}</td>
      <td>{formatCount(usage.sessions)}</td>
      <td>
        <TokenCount value={Math.round(usage.tokens)} />
      </td>
      <td>{MISSING}</td>
      <td>{formatCost(usage.costUsd)}</td>
    </tr>
  );
}

export function FeatureTable({
  rows,
  noWorkItem,
  totals,
  filters,
  sort,
  onSort,
}: FeatureTableProps): ReactElement {
  const showProject = filters.project === undefined;
  return (
    <div className="table-scroll">
      <table className="session-table feature-table" aria-label="Issues">
        <FeatureTableHead
          showProject={showProject}
          sort={sort}
          onSort={onSort}
        />
        <tbody>
          {sortFeatures(rows, sort).map((row) => (
            <IssueRow
              key={`${row.project} ${String(row.number)}`}
              row={row}
              path={featurePath(row, filters)}
              showProject={showProject}
            />
          ))}
          {noWorkItem !== null && (
            <NoWorkItemRow usage={noWorkItem} showProject={showProject} />
          )}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="left">
              Total
            </th>
            <td colSpan={showProject ? 5 : 4} />
            <td>
              <TokenCount value={Math.round(totals.tokens)} />
            </td>
            <td />
            <td>{formatCost(totals.costUsd)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
