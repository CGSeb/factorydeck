import { type ReactElement, useId } from 'react';
import type { RoleUsage } from '../roles/types.ts';
import { BarCell } from './components/BarCell.tsx';
import { DataTable, NUMERIC_CELL, TotalRow } from './components/DataTable.tsx';
import { RoleTag } from './components/RoleTag.tsx';
import { TokenAmount } from './components/TokenAmount.tsx';
import { formatCount } from './format.ts';
import { roleTotals, tokensPerThread } from './roles-view.ts';

export const TABLE_HEADING = 'fd-panel-heading';

export const headingSpace = { marginBottom: 'var(--fd-space-3)' };

export const tokensColumn = { width: '32%', minWidth: '180px' };

function RoleRow({
  row,
  color,
  largest,
}: {
  row: RoleUsage;
  color: string;
  largest: number;
}): ReactElement {
  return (
    <tr>
      <th scope="row">
        <RoleTag role={row.role} color={color} />
      </th>
      <td className={NUMERIC_CELL}>{formatCount(row.threads)}</td>
      <td className={NUMERIC_CELL}>{formatCount(row.apiCalls)}</td>
      <td className={NUMERIC_CELL}>{tokensPerThread(row)}</td>
      <td>
        <BarCell
          counts={row.tokenCounts}
          costUsd={row.costUsd}
          largest={largest}
          color={color}
        />
      </td>
    </tr>
  );
}

function RolesTotalRow({ roles }: { roles: RoleUsage[] }): ReactElement {
  const totals = roleTotals(roles);
  return (
    <TotalRow>
      <th scope="row">Total</th>
      <td className={NUMERIC_CELL}>{formatCount(totals.threads)}</td>
      <td className={NUMERIC_CELL}>{formatCount(totals.apiCalls)}</td>
      <td />
      <td className={NUMERIC_CELL}>
        <TokenAmount counts={totals.tokenCounts} costUsd={totals.costUsd} />
      </td>
    </TotalRow>
  );
}

export interface RoleTokensTableProps {
  roles: RoleUsage[];
  colors: Map<string, string>;
}

export function RoleTokensTable({
  roles,
  colors,
}: RoleTokensTableProps): ReactElement {
  const titleId = useId();
  const largest = roles.reduce((max, row) => Math.max(max, row.tokens), 0);
  return (
    <div>
      <h2 id={titleId} className={TABLE_HEADING} style={headingSpace}>
        By role
      </h2>
      <DataTable label="By role">
        <table aria-labelledby={titleId}>
          <thead>
            <tr>
              <th scope="col">Role</th>
              <th scope="col" className={NUMERIC_CELL}>
                Threads
              </th>
              <th scope="col" className={NUMERIC_CELL}>
                API calls
              </th>
              <th scope="col" className={NUMERIC_CELL}>
                Tokens per thread
              </th>
              <th scope="col" style={tokensColumn}>
                Tokens
              </th>
            </tr>
          </thead>
          <tbody>
            {roles.map((row) => (
              <RoleRow
                key={row.role}
                row={row}
                color={colors.get(row.role) ?? 'var(--fd-muted)'}
                largest={largest}
              />
            ))}
          </tbody>
          <tfoot>
            <RolesTotalRow roles={roles} />
          </tfoot>
        </table>
      </DataTable>
    </div>
  );
}
