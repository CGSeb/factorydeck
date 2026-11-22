import { type ReactElement, useId } from 'react';
import type { RoleUsage } from '../roles/types.ts';
import { DataTable, NUMERIC_CELL, TotalRow } from './components/DataTable.tsx';
import { RoleTag } from './components/RoleTag.tsx';
import { SplitBar } from './components/SplitBar.tsx';
import { formatCount } from './format.ts';
import { roleTotals, tokensPerThread } from './roles-view.ts';

export const TABLE_HEADING = 'fd-panel-heading';

export const headingSpace = { marginBottom: 'var(--fd-space-3)' };

export const barSpace = { marginBottom: 'var(--fd-space-4)' };

function RoleRow({
  row,
  color,
}: {
  row: RoleUsage;
  color: string;
}): ReactElement {
  return (
    <tr>
      <th scope="row">
        <RoleTag role={row.role} color={color} />
      </th>
      <td className={NUMERIC_CELL}>{formatCount(row.threads)}</td>
      <td className={NUMERIC_CELL}>{formatCount(row.apiCalls)}</td>
      <td className={NUMERIC_CELL}>{tokensPerThread(row)}</td>
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
  return (
    <div>
      <h2 id={titleId} className={TABLE_HEADING} style={headingSpace}>
        By role
      </h2>
      <div style={barSpace}>
        <SplitBar
          label="Tokens by role"
          height="tall"
          segments={roles.map((row) => ({
            label: row.role,
            value: row.tokens,
            color: colors.get(row.role) ?? 'var(--fd-muted)',
          }))}
        />
      </div>
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
            </tr>
          </thead>
          <tbody>
            {roles.map((row) => (
              <RoleRow
                key={row.role}
                row={row}
                color={colors.get(row.role) ?? 'var(--fd-muted)'}
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
