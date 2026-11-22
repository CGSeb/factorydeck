import { type ReactElement, useId } from 'react';
import type { RoleUsage } from '../roles/types.ts';
import { formatCost, formatCount } from './format.ts';
import { TokenCount } from './TokenCount.tsx';

export function RoleTable({ roles }: { roles: RoleUsage[] }): ReactElement {
  const titleId = useId();
  return (
    <section className="panel" aria-labelledby={titleId}>
      <h2 id={titleId}>By role</h2>
      <table aria-labelledby={titleId}>
        <thead>
          <tr>
            <th scope="col" className="left">
              Role
            </th>
            <th scope="col">Threads</th>
            <th scope="col">API calls</th>
            <th scope="col">Tokens</th>
            <th scope="col">Cost</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((row) => (
            <tr key={row.role}>
              <th scope="row" className="left">
                {row.role}
              </th>
              <td>{formatCount(row.threads)}</td>
              <td>{formatCount(row.apiCalls)}</td>
              <td>
                <TokenCount value={Math.round(row.tokens)} />
              </td>
              <td>{formatCost(row.costUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
