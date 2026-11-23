import type { ReactElement } from 'react';
import type {
  CompactionRow,
  FrictionKind,
  FrictionStats,
  HookRow,
} from '../frictions/types.ts';
import { NUMERIC_CELL } from './components/DataTable.tsx';
import { formatCount, formatDateTime } from './format.ts';
import {
  TRIGGER_LABELS,
  compactTokens,
  hookText,
  showsKind,
} from './frictions-view.ts';
import { PagedTable } from './PagedTable.tsx';
import type { LinkScope } from './session-links.ts';
import {
  CategoryTable,
  CommandTable,
  RepeatedTable,
  ToolTable,
} from './ToolErrorTables.tsx';

export function HookTable({
  rows,
}: {
  rows: readonly HookRow[];
}): ReactElement {
  return (
    <PagedTable
      title="Stop blocked"
      rows={rows}
      className="fd-friction-table fd-friction-hooks"
      head={
        <>
          <th scope="col">Hook</th>
          <th scope="col" className={`${NUMERIC_CELL} fd-friction-count-col`}>
            Blocks
          </th>
          <th scope="col" className={`${NUMERIC_CELL} fd-friction-count-col`}>
            Sessions
          </th>
          <th scope="col" className="fd-friction-last-col">
            Last
          </th>
        </>
      }
      renderRow={(row) => (
        <tr key={row.command}>
          <th scope="row" className="fd-friction-mono">
            <span className="fd-friction-hook" title={hookText(row.command)}>
              {hookText(row.command)}
            </span>
          </th>
          <td className={NUMERIC_CELL}>{formatCount(row.blocks)}</td>
          <td className={NUMERIC_CELL}>{formatCount(row.sessions)}</td>
          <td className="fd-friction-nowrap">{formatDateTime(row.lastAt)}</td>
        </tr>
      )}
    />
  );
}

export function CompactionTable({
  rows,
}: {
  rows: readonly CompactionRow[];
}): ReactElement {
  return (
    <PagedTable
      title="Compactions"
      rows={rows}
      className="fd-friction-table"
      head={
        <>
          <th scope="col">Trigger</th>
          <th scope="col" className={NUMERIC_CELL}>
            Compactions
          </th>
          <th scope="col" className={NUMERIC_CELL}>
            Median tokens before
          </th>
          <th scope="col" className={NUMERIC_CELL}>
            Threads
          </th>
        </>
      }
      renderRow={(row) => (
        <tr key={row.trigger}>
          <th scope="row">{TRIGGER_LABELS[row.trigger]}</th>
          <td className={NUMERIC_CELL}>{formatCount(row.compactions)}</td>
          <td className={NUMERIC_CELL}>{compactTokens(row.medianPreTokens)}</td>
          <td className={NUMERIC_CELL}>{formatCount(row.threads)}</td>
        </tr>
      )}
    />
  );
}

export interface FrictionTablesProps {
  stats: FrictionStats;
  kind: FrictionKind | undefined;
  scope: LinkScope;
}

export function FrictionTables({
  stats,
  kind,
  scope,
}: FrictionTablesProps): ReactElement {
  const toolErrors = showsKind(kind, 'tool-error');
  const shown = (wanted: FrictionKind, rows: readonly unknown[]): boolean =>
    showsKind(kind, wanted) && rows.length > 0;
  return (
    <div className="fd-friction-tables">
      {shown('tool-error', stats.categories) && (
        <CategoryTable rows={stats.categories} />
      )}
      {shown('tool-error', stats.tools) && <ToolTable rows={stats.tools} />}
      {shown('tool-error', stats.commands) && (
        <CommandTable rows={stats.commands} />
      )}
      {toolErrors && <RepeatedTable rows={stats.repeated} scope={scope} />}
      {shown('stop-blocked', stats.hooks) && <HookTable rows={stats.hooks} />}
      {shown('compaction', stats.compactions) && (
        <CompactionTable rows={stats.compactions} />
      )}
    </div>
  );
}
