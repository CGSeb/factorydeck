import type { ReactElement } from 'react';
import { Link } from 'react-router';
import type {
  ContextPeaks,
  FrictionKind,
  FrictionStats,
  IssueFrictionRow,
  RoleFrictionRow,
} from '../frictions/types.ts';
import type { Period } from '../overview/types.ts';
import { NUMERIC_CELL } from './components/DataTable.tsx';
import { Panel } from './components/Panel.tsx';
import { ProjectTag } from './components/ProjectTag.tsx';
import { RangeStrip } from './components/RangeStrip.tsx';
import { RoleTag } from './components/RoleTag.tsx';
import { StageBadge } from './components/StageBadge.tsx';
import { StatFigure } from './components/StatFigure.tsx';
import { projectColors, roleColors } from './design/palette.ts';
import { MISSING, formatCount } from './format.ts';
import {
  THREAD_NOUN,
  compactTokens,
  compactedText,
  issueText,
  mainKindText,
  peakLabel,
  perThreadText,
  showsKind,
} from './frictions-view.ts';
import { PagedTable } from './PagedTable.tsx';
import { type LinkScope, issueHref, sessionHref } from './session-links.ts';
import { comparisonText } from './stats-view.ts';

export const ROLES_TITLE = 'By role';
export const ISSUES_TITLE = 'Issues with the most frictions';
export const PEAKS_TITLE = 'Context peaks';

function Numeric({ label }: { label: string }): ReactElement {
  return (
    <th scope="col" className={NUMERIC_CELL}>
      {label}
    </th>
  );
}

export function RoleFrictionTable({
  rows,
}: {
  rows: readonly RoleFrictionRow[];
}): ReactElement {
  const colors = roleColors(rows.map((row) => row.role));
  return (
    <PagedTable
      title={ROLES_TITLE}
      rows={rows}
      className="fd-friction-table"
      head={
        <>
          <th scope="col">Role</th>
          <Numeric label="Threads" />
          <Numeric label="Frictions" />
          <Numeric label="Per thread" />
          <th scope="col">Main kind</th>
        </>
      }
      renderRow={(row) => (
        <tr key={row.role}>
          <th scope="row">
            <RoleTag
              role={row.role}
              color={colors.get(row.role) ?? 'var(--fd-line)'}
            />
          </th>
          <td className={NUMERIC_CELL}>{formatCount(row.threads)}</td>
          <td className={NUMERIC_CELL}>{formatCount(row.frictions)}</td>
          <td className={NUMERIC_CELL}>{perThreadText(row.perThread)}</td>
          <td>{mainKindText(row.mainKind)}</td>
        </tr>
      )}
    />
  );
}

export interface IssueFrictionTableProps {
  rows: readonly IssueFrictionRow[];
  scope: LinkScope;
  projects: readonly string[];
}

export function IssueFrictionTable({
  rows,
  scope,
  projects,
}: IssueFrictionTableProps): ReactElement {
  const showProject = scope.project === undefined;
  const colors = projectColors([...projects]);
  return (
    <PagedTable
      title={ISSUES_TITLE}
      rows={rows}
      className="fd-friction-table-wide fd-friction-issues"
      head={
        <>
          <th scope="col">Issue</th>
          {showProject && <th scope="col">Project</th>}
          <th scope="col">Stage</th>
          <Numeric label="Frictions" />
          <Numeric label="Repeated failures" />
          <Numeric label="Compactions" />
        </>
      }
      renderRow={(row) => {
        const text = issueText(row.number, row.issue);
        return (
          <tr key={`${row.project} ${String(row.number)}`}>
            <th scope="row">
              <Link
                className="fd-friction-issue"
                to={issueHref(row.number, row.project, scope)}
                title={text}
              >
                {text}
              </Link>
            </th>
            {showProject && (
              <td>
                <ProjectTag
                  project={row.project}
                  name={row.projectName}
                  color={colors.get(row.project) ?? 'var(--fd-muted)'}
                />
              </td>
            )}
            <td>
              {row.stage === null ? MISSING : <StageBadge stage={row.stage} />}
            </td>
            <td className={NUMERIC_CELL}>{formatCount(row.frictions)}</td>
            <td className={NUMERIC_CELL}>{formatCount(row.repeated)}</td>
            <td className={NUMERIC_CELL}>{formatCount(row.compactions)}</td>
          </tr>
        );
      }}
    />
  );
}

export function ContextPeaksPanel({
  context,
  scope,
  period,
}: {
  context: ContextPeaks;
  scope: LinkScope;
  period: Period;
}): ReactElement {
  const comparison = comparisonText(period);
  const { previous } = context;
  return (
    <Panel heading={PEAKS_TITLE}>
      <div className="fd-friction-peaks">
        <StatFigure
          label="Median context peak"
          value={context.medianPeak}
          format={compactTokens}
          kind="amount"
          n={context.threads.length}
          noun={THREAD_NOUN}
          better="lower"
          {...(comparison === undefined || previous === undefined
            ? {}
            : {
                previous: previous.medianPeak,
                previousN: previous.threads,
                comparison,
              })}
        />
        <p className="fd-friction-note">
          {compactedText(context.compacted, context.threads.length)}
        </p>
      </div>
      <RangeStrip
        label="Context peak by thread"
        items={context.threads.map((thread) => ({
          label: peakLabel(thread),
          value: thread.peak,
          href: sessionHref(thread.sessionId, scope),
        }))}
        format={compactTokens}
      />
    </Panel>
  );
}

export interface FrictionBreakdownProps {
  stats: FrictionStats;
  kind: FrictionKind | undefined;
  scope: LinkScope;
  period: Period;
  withTables: boolean;
}

export function FrictionBreakdown({
  stats,
  kind,
  scope,
  period,
  withTables,
}: FrictionBreakdownProps): ReactElement {
  return (
    <>
      {withTables && (
        <div className="fd-friction-tables">
          <RoleFrictionTable rows={stats.roles} />
          {stats.issues.length > 0 && (
            <IssueFrictionTable
              rows={stats.issues}
              scope={scope}
              projects={stats.projects.map((option) => option.project)}
            />
          )}
        </div>
      )}
      {showsKind(kind, 'compaction') && (
        <ContextPeaksPanel
          context={stats.context}
          scope={scope}
          period={period}
        />
      )}
    </>
  );
}
