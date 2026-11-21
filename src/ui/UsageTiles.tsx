import type { ReactElement } from 'react';
import type { UsageOverview } from '../overview/types.ts';
import { formatCost, formatCount } from './format.ts';
import { TokenCount } from './TokenCount.tsx';

export interface UsageTilesProps {
  totals: UsageOverview['totals'];
}

export function UsageTiles({ totals }: UsageTilesProps): ReactElement {
  const { tokens } = totals;
  const breakdown = [
    { label: 'Input', value: tokens.input },
    { label: 'Cache write', value: tokens.cacheWrite },
    { label: 'Cache read', value: tokens.cacheRead },
    { label: 'Output', value: tokens.output },
  ];
  const total = breakdown.reduce((sum, { value }) => sum + value, 0);
  return (
    <section className="tiles" aria-label="Totals">
      <div className="tile">
        <h2>Cost</h2>
        <p className="tile-value">{formatCost(totals.costUsd)}</p>
        {totals.unknownPriceCalls > 0 && (
          <p className="tile-note">
            Excludes {totals.unknownPriceCalls} calls with unknown prices.
          </p>
        )}
      </div>
      <div className="tile">
        <h2>Tokens</h2>
        <p className="tile-value">
          <TokenCount value={total} />
        </p>
        <dl className="breakdown">
          {breakdown.map(({ label, value }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                <TokenCount value={value} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="tile">
        <h2>Sessions</h2>
        <p className="tile-value">{formatCount(totals.sessions)}</p>
      </div>
      <div className="tile">
        <h2>API calls</h2>
        <p className="tile-value">{formatCount(totals.apiCalls)}</p>
      </div>
    </section>
  );
}
