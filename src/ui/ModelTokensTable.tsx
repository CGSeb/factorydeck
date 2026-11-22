import { type ReactElement, useId } from 'react';
import type { ModelUsage } from '../overview/types.ts';
import { BarCell } from './components/BarCell.tsx';
import { DataTable, NUMERIC_CELL } from './components/DataTable.tsx';
import { MISSING, formatCount } from './format.ts';
import {
  TABLE_HEADING,
  headingSpace,
  tokensColumn,
} from './RoleTokensTable.tsx';

const mono = { fontFamily: 'var(--fd-font-mono)', fontWeight: 400 };

export function ModelTokensTable({
  models,
}: {
  models: ModelUsage[];
}): ReactElement {
  const titleId = useId();
  const largest = models.reduce((max, row) => Math.max(max, row.tokens), 0);
  return (
    <div>
      <h2 id={titleId} className={TABLE_HEADING} style={headingSpace}>
        By model
      </h2>
      <DataTable label="By model">
        <table aria-labelledby={titleId}>
          <thead>
            <tr>
              <th scope="col">Model</th>
              <th scope="col" className={NUMERIC_CELL}>
                API calls
              </th>
              <th scope="col" style={tokensColumn}>
                Tokens
              </th>
            </tr>
          </thead>
          <tbody>
            {models.map((row) => (
              <tr key={row.model}>
                <th scope="row" style={mono}>
                  {row.model === '' ? MISSING : row.model}
                </th>
                <td className={NUMERIC_CELL}>{formatCount(row.apiCalls)}</td>
                <td>
                  <BarCell
                    counts={row.tokenCounts}
                    costUsd={row.costUsd}
                    largest={largest}
                    color="var(--fd-accent)"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTable>
    </div>
  );
}
