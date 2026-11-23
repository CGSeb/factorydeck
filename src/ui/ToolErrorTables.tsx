import type { ReactElement } from 'react';
import { Link } from 'react-router';
import type {
  CategoryRow,
  CommandRow,
  RepeatedRow,
  ToolRow,
} from '../frictions/types.ts';
import {
  categoryParam,
  commandParam,
  repeatedParam,
  toolParam,
} from '../frictions/occurrence-types.ts';
import { NUMERIC_CELL } from './components/DataTable.tsx';
import { RoleTag } from './components/RoleTag.tsx';
import { roleColors } from './design/palette.ts';
import { MISSING, formatCount, formatDateTime } from './format.ts';
import {
  CATEGORY_LABELS,
  exitCodesText,
  programLabel,
  programText,
  shareText,
  shortSessionTitle,
} from './frictions-view.ts';
import { OccurrenceRows } from './FrictionOccurrences.tsx';
import { PagedTable } from './PagedTable.tsx';
import { type LinkScope, issueHref, sessionHref } from './session-links.ts';

const TABLE = 'fd-friction-table';
const WIDE_TABLE = 'fd-friction-table-wide';
const MONO = 'fd-friction-mono';

export const NO_REPEATED_FAILURE = 'No command failed 3 times in one thread.';

function Numeric({ label }: { label: string }): ReactElement {
  return (
    <th scope="col" className={NUMERIC_CELL}>
      {label}
    </th>
  );
}

export function CategoryTable({
  rows,
}: {
  rows: readonly CategoryRow[];
}): ReactElement {
  const total = rows.reduce((sum, row) => sum + row.errors, 0);
  return (
    <PagedTable
      title="By category"
      rows={rows}
      className={TABLE}
      head={
        <>
          <th scope="col">Category</th>
          <Numeric label="Errors" />
          <Numeric label="Share" />
        </>
      }
      renderRow={(row) => (
        <OccurrenceRows
          key={row.category}
          table="category"
          row={categoryParam(row.category)}
          label={CATEGORY_LABELS[row.category]}
          colSpan={3}
          header={CATEGORY_LABELS[row.category]}
          cells={
            <>
              <td className={NUMERIC_CELL}>{formatCount(row.errors)}</td>
              <td className={NUMERIC_CELL}>{shareText(row.errors, total)}</td>
            </>
          }
        />
      )}
    />
  );
}

export function ToolTable({
  rows,
}: {
  rows: readonly ToolRow[];
}): ReactElement {
  return (
    <PagedTable
      title="By tool"
      rows={rows}
      className={TABLE}
      head={
        <>
          <th scope="col">Tool</th>
          <Numeric label="Errors" />
          <th scope="col">Main category</th>
          <Numeric label="Threads" />
        </>
      }
      renderRow={(row) => (
        <OccurrenceRows
          key={row.tool}
          table="tool"
          row={toolParam(row)}
          label={row.tool}
          colSpan={4}
          headerClassName={MONO}
          header={row.tool}
          cells={
            <>
              <td className={NUMERIC_CELL}>{formatCount(row.errors)}</td>
              <td>{CATEGORY_LABELS[row.mainCategory]}</td>
              <td className={NUMERIC_CELL}>{formatCount(row.threads)}</td>
            </>
          }
        />
      )}
    />
  );
}

export function CommandTable({
  rows,
}: {
  rows: readonly CommandRow[];
}): ReactElement {
  return (
    <PagedTable
      title="Failed commands"
      rows={rows}
      className={TABLE}
      head={
        <>
          <th scope="col">Program</th>
          <Numeric label="Failures" />
          <th scope="col">Exit codes</th>
          <Numeric label="Distinct commands" />
        </>
      }
      renderRow={(row) => (
        <OccurrenceRows
          key={row.program ?? ''}
          table="command"
          row={commandParam(row)}
          label={programLabel(row.program)}
          colSpan={4}
          headerClassName={MONO}
          header={programText(row.program)}
          cells={
            <>
              <td className={NUMERIC_CELL}>{formatCount(row.failures)}</td>
              <td>{exitCodesText(row.exitCodes)}</td>
              <td className={NUMERIC_CELL}>
                {formatCount(row.distinctCommands)}
              </td>
            </>
          }
        />
      )}
    />
  );
}

function RepeatedLine({
  row,
  color,
  scope,
}: {
  row: RepeatedRow;
  color: string;
  scope: LinkScope;
}): ReactElement {
  return (
    <OccurrenceRows
      table="repeated"
      row={repeatedParam(row)}
      label={programLabel(row.program)}
      colSpan={6}
      headerClassName={MONO}
      header={programText(row.program)}
      cells={<RepeatedCells row={row} color={color} scope={scope} />}
    />
  );
}

function RepeatedCells({
  row,
  color,
  scope,
}: {
  row: RepeatedRow;
  color: string;
  scope: LinkScope;
}): ReactElement {
  return (
    <>
      <td className={NUMERIC_CELL}>{formatCount(row.failures)}</td>
      <td>
        <RoleTag role={row.role} color={color} />
      </td>
      <td>
        {row.workItem === null ? (
          MISSING
        ) : (
          <Link to={issueHref(row.workItem, row.project, scope)}>
            #{row.workItem}
          </Link>
        )}
      </td>
      <td>
        <Link to={sessionHref(row.sessionId, scope)}>
          {shortSessionTitle(row.sessionTitle, row.sessionId)}
        </Link>
      </td>
      <td className="fd-friction-nowrap">{formatDateTime(row.lastAt)}</td>
    </>
  );
}

export function RepeatedTable({
  rows,
  scope,
}: {
  rows: readonly RepeatedRow[];
  scope: LinkScope;
}): ReactElement {
  const colors = roleColors(rows.map((row) => row.role));
  return (
    <PagedTable
      title="Repeated failures"
      rows={rows}
      className={WIDE_TABLE}
      empty={NO_REPEATED_FAILURE}
      head={
        <>
          <th scope="col">Program</th>
          <Numeric label="Failures" />
          <th scope="col">Role</th>
          <th scope="col">Issue</th>
          <th scope="col">Session</th>
          <th scope="col">Last</th>
        </>
      }
      renderRow={(row, index) => (
        <RepeatedLine
          key={`${String(index)} ${repeatedParam(row)}`}
          row={row}
          color={colors.get(row.role) ?? 'var(--fd-line)'}
          scope={scope}
        />
      )}
    />
  );
}
