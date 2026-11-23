import type { ReactElement } from 'react';
import { Link } from 'react-router';
import type {
  CategoryRow,
  CommandRow,
  RepeatedRow,
  ToolRow,
} from '../frictions/types.ts';
import { NUMERIC_CELL } from './components/DataTable.tsx';
import { RoleTag } from './components/RoleTag.tsx';
import { roleColors } from './design/palette.ts';
import { MISSING, formatCount, formatDateTime } from './format.ts';
import {
  CATEGORY_LABELS,
  exitCodesText,
  programText,
  shareText,
  shortSessionTitle,
} from './frictions-view.ts';
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
        <tr key={row.category}>
          <th scope="row">{CATEGORY_LABELS[row.category]}</th>
          <td className={NUMERIC_CELL}>{formatCount(row.errors)}</td>
          <td className={NUMERIC_CELL}>{shareText(row.errors, total)}</td>
        </tr>
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
        <tr key={row.tool}>
          <th scope="row" className={MONO}>
            {row.tool}
          </th>
          <td className={NUMERIC_CELL}>{formatCount(row.errors)}</td>
          <td>{CATEGORY_LABELS[row.mainCategory]}</td>
          <td className={NUMERIC_CELL}>{formatCount(row.threads)}</td>
        </tr>
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
        <tr key={row.program ?? ''}>
          <th scope="row" className={MONO}>
            {programText(row.program)}
          </th>
          <td className={NUMERIC_CELL}>{formatCount(row.failures)}</td>
          <td>{exitCodesText(row.exitCodes)}</td>
          <td className={NUMERIC_CELL}>{formatCount(row.distinctCommands)}</td>
        </tr>
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
    <tr>
      <th scope="row" className={MONO}>
        {programText(row.program)}
      </th>
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
    </tr>
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
          key={`${String(index)} ${row.sessionId} ${row.lastAt}`}
          row={row}
          color={colors.get(row.role) ?? 'var(--fd-line)'}
          scope={scope}
        />
      )}
    />
  );
}
