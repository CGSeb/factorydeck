import type { CSSProperties, ReactElement } from 'react';
import { barPercent } from './chart-math.ts';
import { type TokenCounts, totalTokens } from './token-amount.ts';
import { TokenAmount } from './TokenAmount.tsx';

export interface BarCellProps {
  counts: TokenCounts;
  costUsd: number | null;
  unknownPriceCalls?: number;
  largest: number;
  color: string;
}

const cell: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--fd-space-2)',
};

const track: CSSProperties = {
  flex: '1 1 0px',
  minWidth: 0,
  height: '10px',
  borderRadius: 'var(--fd-radius-pill)',
  background: 'var(--fd-line)',
  overflow: 'hidden',
};

const amount: CSSProperties = {
  flex: 'none',
  minWidth: '48px',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};

export function BarCell({
  counts,
  costUsd,
  unknownPriceCalls = 0,
  largest,
  color,
}: BarCellProps): ReactElement {
  const percent = barPercent(totalTokens(counts), largest);
  return (
    <div style={cell}>
      <div aria-hidden="true" data-bar-track="" style={track}>
        {percent > 0 ? (
          <div
            data-bar=""
            style={{
              width: `${String(percent)}%`,
              height: '100%',
              borderRadius: 'var(--fd-radius-pill)',
              background: color,
            }}
          />
        ) : null}
      </div>
      <span style={amount}>
        <TokenAmount
          counts={counts}
          costUsd={costUsd}
          unknownPriceCalls={unknownPriceCalls}
        />
      </span>
    </div>
  );
}
