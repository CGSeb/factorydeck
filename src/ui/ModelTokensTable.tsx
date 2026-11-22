import { type ReactElement, useId } from 'react';
import type { ModelUsage } from '../overview/types.ts';
import { DataTable, NUMERIC_CELL } from './components/DataTable.tsx';
import { dotStyle, tagStyle } from './components/label-styles.ts';
import { SplitBar } from './components/SplitBar.tsx';
import { MISSING, formatCount } from './format.ts';
import { TABLE_HEADING, barSpace, headingSpace } from './RoleTokensTable.tsx';

const mono = { fontFamily: 'var(--fd-font-mono)', fontWeight: 400 };

export function modelLabel(model: string): string {
  return model === '' ? MISSING : model;
}

export function ModelTokensTable({
  models,
  colors,
}: {
  models: ModelUsage[];
  colors: Map<string, string>;
}): ReactElement {
  const titleId = useId();
  return (
    <div>
      <h2 id={titleId} className={TABLE_HEADING} style={headingSpace}>
        By model
      </h2>
      <div style={barSpace}>
        <SplitBar
          label="Tokens by model"
          height="tall"
          segments={models.map((row) => ({
            label: modelLabel(row.model),
            value: row.tokens,
            color: colors.get(row.model) ?? 'var(--fd-muted)',
          }))}
        />
      </div>
      <DataTable label="By model">
        <table aria-labelledby={titleId}>
          <thead>
            <tr>
              <th scope="col">Model</th>
              <th scope="col" className={NUMERIC_CELL}>
                API calls
              </th>
            </tr>
          </thead>
          <tbody>
            {models.map((row) => (
              <tr key={row.model}>
                <th scope="row" style={mono}>
                  <span style={tagStyle}>
                    <span
                      aria-hidden="true"
                      style={dotStyle(
                        9,
                        '3px',
                        colors.get(row.model) ?? 'var(--fd-muted)',
                      )}
                    />
                    {modelLabel(row.model)}
                  </span>
                </th>
                <td className={NUMERIC_CELL}>{formatCount(row.apiCalls)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTable>
    </div>
  );
}
