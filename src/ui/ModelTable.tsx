import { type ReactElement, useId } from 'react';
import type { ModelUsage } from '../overview/types.ts';
import { MISSING, formatCost, formatCount } from './format.ts';
import { TokenCount } from './TokenCount.tsx';

export function ModelTable({ models }: { models: ModelUsage[] }): ReactElement {
  const titleId = useId();
  return (
    <section className="panel" aria-labelledby={titleId}>
      <h2 id={titleId}>By model</h2>
      <div className="table-scroll">
        <table aria-labelledby={titleId}>
          <thead>
            <tr>
              <th scope="col">Model</th>
              <th scope="col">API calls</th>
              <th scope="col">Tokens</th>
              <th scope="col">Cost</th>
            </tr>
          </thead>
          <tbody>
            {models.map((row) => (
              <tr key={row.model}>
                <th scope="row">{row.model === '' ? MISSING : row.model}</th>
                <td>{formatCount(row.apiCalls)}</td>
                <td>
                  <TokenCount value={row.tokens} />
                </td>
                <td>{formatCost(row.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
