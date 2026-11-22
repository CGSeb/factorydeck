import type { ReactElement } from 'react';
import { Link } from 'react-router';
import type {
  FeatureList,
  FeatureRow,
  FeatureUsage,
} from '../features/types.ts';
import {
  DataTable,
  type GroupMarker,
  GroupHeaderRow,
  NUMERIC_CELL,
  TotalRow,
} from './components/DataTable.tsx';
import { ProjectTag } from './components/ProjectTag.tsx';
import { SplitBar } from './components/SplitBar.tsx';
import type { StageGroup } from './components/StageDot.tsx';
import { TokenAmount } from './components/TokenAmount.tsx';
import { projectColors } from './design/palette.ts';
import { featurePath } from './features-api.ts';
import {
  type FeatureSortKey,
  LIST_GROUP_LABELS,
  type ListGroup,
  groupRows,
  rowRoleColors,
} from './features-list.ts';
import { MISSING, formatCount } from './format.ts';
import { useCollapsedGroups } from './issue-groups-state.ts';
import type { SkillFilters } from './skills-api.ts';
import './features-page.css';

const OTHER_MARKERS: Record<'closed' | 'unknown', string> = {
  closed: 'var(--fd-danger)',
  unknown: 'var(--fd-muted)',
};

function markerOf(group: ListGroup): GroupMarker {
  return group === 'closed' || group === 'unknown'
    ? { color: OTHER_MARKERS[group] }
    : { stage: group };
}

function IssueName({ row }: { row: FeatureRow }): ReactElement {
  const suffix =
    row.issue.status === 'found'
      ? ` ${row.issue.title}`
      : row.issue.status === 'not-found'
        ? ' (not found)'
        : '';
  return (
    <>
      <span className="fd-issue-number">#{row.number}</span>
      {suffix}
    </>
  );
}

function SerenityCell({ row }: { row: FeatureRow }): ReactElement {
  const report = row.outcome?.report ?? null;
  if (report === null) return <td className={NUMERIC_CELL}>{MISSING}</td>;
  const passed = report.score >= report.threshold;
  return (
    <td
      className={`${NUMERIC_CELL} fd-serenity`}
      data-tone={passed ? 'success' : 'warning'}
    >
      {passed ? report.score : `${String(report.score)} below threshold`}
    </td>
  );
}

function IssueTableHead({
  showProject,
}: {
  showProject: boolean;
}): ReactElement {
  return (
    <thead>
      <tr>
        <th scope="col">Issue</th>
        {showProject && <th scope="col">Project</th>}
        <th scope="col">Split by role</th>
        <th scope="col" className={NUMERIC_CELL}>
          Sessions
        </th>
        <th scope="col" className={NUMERIC_CELL}>
          Rounds
        </th>
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

function IssueRow({
  row,
  filters,
  roleColors,
  projectColor,
}: {
  row: FeatureRow;
  filters: SkillFilters;
  roleColors: Map<string, string>;
  projectColor: string | undefined;
}): ReactElement {
  const rounds = row.outcome?.report?.rounds ?? null;
  return (
    <tr>
      <th scope="row">
        <Link className="fd-issue-link" to={featurePath(row, filters)}>
          <IssueName row={row} />
        </Link>
      </th>
      {projectColor !== undefined && (
        <td>
          <ProjectTag
            project={row.project}
            name={row.projectName}
            color={projectColor}
          />
        </td>
      )}
      <td>
        <div className="fd-split-cell">
          <SplitBar
            label={`Tokens by role for #${String(row.number)}`}
            height="thin"
            segments={row.roles.map((share) => ({
              label: share.role,
              value: share.tokens,
              color: roleColors.get(share.role) ?? 'var(--fd-line)',
            }))}
          />
        </div>
      </td>
      <td className={NUMERIC_CELL}>{formatCount(row.sessions)}</td>
      <td className={NUMERIC_CELL}>
        {rounds === null ? MISSING : formatCount(rounds)}
      </td>
      <SerenityCell row={row} />
      <td className={NUMERIC_CELL}>
        <TokenAmount counts={row.tokenCounts} costUsd={row.costUsd} />
      </td>
    </tr>
  );
}

function UsageCells({
  usage,
  unknownPriceCalls,
  blanks,
  strong,
}: {
  usage: Pick<FeatureUsage, 'sessions' | 'tokenCounts' | 'costUsd'>;
  unknownPriceCalls: number;
  blanks: number;
  strong: boolean;
}): ReactElement {
  return (
    <>
      <td colSpan={blanks} />
      <td className={NUMERIC_CELL}>{formatCount(usage.sessions)}</td>
      <td colSpan={2} />
      <td className={NUMERIC_CELL}>
        <TokenAmount
          counts={usage.tokenCounts}
          costUsd={usage.costUsd}
          unknownPriceCalls={unknownPriceCalls}
          size={strong ? 'strong' : 'inline'}
        />
      </td>
    </>
  );
}

function OtherRows({
  list,
  blanks,
}: {
  list: FeatureList;
  blanks: number;
}): ReactElement {
  const { noWorkItem, totals } = list;
  return (
    <tbody>
      {noWorkItem !== null && (
        <tr>
          <th scope="row">No work item</th>
          <UsageCells
            usage={noWorkItem}
            unknownPriceCalls={0}
            blanks={blanks}
            strong={false}
          />
        </tr>
      )}
      <TotalRow>
        <th scope="row">Total</th>
        <UsageCells
          usage={totals}
          unknownPriceCalls={totals.unknownPriceCalls}
          blanks={blanks}
          strong
        />
      </TotalRow>
    </tbody>
  );
}

export interface IssueGroupsTableProps {
  list: FeatureList;
  filters: SkillFilters;
  sort: FeatureSortKey;
  stage: StageGroup | null;
}

export function IssueGroupsTable({
  list,
  filters,
  sort,
  stage,
}: IssueGroupsTableProps): ReactElement {
  const showProject = filters.project === undefined;
  const projects = projectColors(list.projects.map(({ project }) => project));
  const roleColors = rowRoleColors(list.rows);
  const columns = showProject ? 7 : 6;
  const [collapsed, toggleGroup] = useCollapsedGroups();
  return (
    <DataTable label="Issues">
      <table className="fd-features-table">
        <IssueTableHead showProject={showProject} />
        {groupRows(list.rows, sort, stage).map(({ group, rows }) => (
          <tbody key={group}>
            <GroupHeaderRow
              name={LIST_GROUP_LABELS[group]}
              count={rows.length}
              colSpan={columns}
              marker={markerOf(group)}
              expanded={!collapsed.has(group)}
              onToggle={() => {
                toggleGroup(group);
              }}
            />
            {!collapsed.has(group) &&
              rows.map((row) => (
                <IssueRow
                  key={`${row.project} ${String(row.number)}`}
                  row={row}
                  filters={filters}
                  roleColors={roleColors}
                  projectColor={
                    showProject
                      ? (projects.get(row.project) ?? 'var(--fd-muted)')
                      : undefined
                  }
                />
              ))}
          </tbody>
        ))}
        {stage === null && (
          <OtherRows list={list} blanks={showProject ? 2 : 1} />
        )}
      </table>
    </DataTable>
  );
}
