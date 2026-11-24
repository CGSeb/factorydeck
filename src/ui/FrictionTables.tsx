import { type ReactElement, useCallback } from 'react';
import { hookParam } from '../frictions/occurrence-types.ts';
import type {
  FrictionKind,
  FrictionStats,
  HookRow,
} from '../frictions/types.ts';
import { NUMERIC_CELL } from './components/DataTable.tsx';
import { formatCount, formatDateTime } from './format.ts';
import type { FrictionFilters } from './frictions-api.ts';
import { hookLabel, hookText, showsKind } from './frictions-view.ts';
import {
  type OccurrenceControls,
  OccurrenceRows,
  OccurrencesProvider,
  useOpenRows,
} from './FrictionOccurrences.tsx';
import type { LoadOccurrences, LoadOutput } from './occurrences-api.ts';
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
        <OccurrenceRows
          key={row.command}
          table="hook"
          row={hookParam(row)}
          label={hookLabel(row.command)}
          colSpan={4}
          headerClassName="fd-friction-mono"
          header={
            <span className="fd-friction-hook" title={hookText(row.command)}>
              {hookText(row.command)}
            </span>
          }
          cells={
            <>
              <td className={NUMERIC_CELL}>{formatCount(row.blocks)}</td>
              <td className={NUMERIC_CELL}>{formatCount(row.sessions)}</td>
              <td className="fd-friction-nowrap">
                {formatDateTime(row.lastAt)}
              </td>
            </>
          }
        />
      )}
    />
  );
}

export interface FrictionTablesProps {
  stats: FrictionStats;
  kind: FrictionKind | undefined;
  scope: LinkScope;
  filters: FrictionFilters;
  loadOccurrences: LoadOccurrences;
  loadOutput: LoadOutput;
}

function useOccurrenceControls(
  filters: FrictionFilters,
  scope: LinkScope,
  loadOccurrences: LoadOccurrences,
  loadOutput: LoadOutput,
): OccurrenceControls {
  const filtersKey = JSON.stringify(filters);
  const { isOpen, toggle } = useOpenRows(filtersKey);
  const load = useCallback<OccurrenceControls['load']>(
    (table, row) => loadOccurrences({ filters, table, row }),
    [loadOccurrences, filtersKey],
  );
  return { scope, isOpen, toggle, load, loadOutput };
}

export function FrictionTables({
  stats,
  kind,
  scope,
  filters,
  loadOccurrences,
  loadOutput,
}: FrictionTablesProps): ReactElement {
  const controls = useOccurrenceControls(
    filters,
    scope,
    loadOccurrences,
    loadOutput,
  );
  const toolErrors = showsKind(kind, 'tool-error');
  const shown = (wanted: FrictionKind, rows: readonly unknown[]): boolean =>
    showsKind(kind, wanted) && rows.length > 0;
  return (
    <OccurrencesProvider value={controls}>
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
      </div>
    </OccurrencesProvider>
  );
}
