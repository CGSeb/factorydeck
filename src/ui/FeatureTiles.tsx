import type { ReactElement } from 'react';
import type { FeatureTotals, MergedSummary } from '../features/types.ts';
import { MISSING, formatCost, formatCount } from './format.ts';

export interface FeatureTilesProps {
  totals: FeatureTotals;
  merged: MergedSummary;
}

function UnknownPrices({ calls }: { calls: number }): ReactElement | null {
  if (calls === 0) return null;
  return (
    <p className="tile-note">Excludes {calls} calls with unknown prices.</p>
  );
}

export function formatShare(share: number | null): string {
  return share === null ? MISSING : `${String(Math.round(share * 100))}%`;
}

export function FeatureTiles({
  totals,
  merged,
}: FeatureTilesProps): ReactElement {
  return (
    <section className="tiles" aria-label="Totals">
      <div className="tile">
        <h2>Cost</h2>
        <p className="tile-value">{formatCost(totals.costUsd)}</p>
        <UnknownPrices calls={totals.unknownPriceCalls} />
      </div>
      <div className="tile">
        <h2>Merged issues</h2>
        <p className="tile-value">{formatCount(merged.issues)}</p>
      </div>
      <div className="tile">
        <h2>Cost per merged issue</h2>
        <p className="tile-value">{formatCost(merged.costPerIssueUsd)}</p>
        <UnknownPrices calls={merged.unknownPriceCalls} />
      </div>
      <div className="tile">
        <h2>Merged without a person</h2>
        <p className="tile-value">{formatShare(merged.withoutPerson)}</p>
      </div>
    </section>
  );
}
