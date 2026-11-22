import type { CSSProperties, ReactElement } from 'react';
import { formatTokens } from '../format.ts';
import { barPercent, shareText } from './chart-math.ts';
import {
  chartTooltip,
  chartTooltipLabel,
  chartTooltipValue,
  useHoverAnchor,
} from './chart-tooltip.ts';
import { type TokenCounts, totalTokens } from './token-amount.ts';
import { TokenAmount } from './TokenAmount.tsx';

export interface BarCellProps {
  label: string;
  counts: TokenCounts;
  costUsd: number | null;
  unknownPriceCalls?: number;
  total: number;
  color: string;
}

/** Extra px above and below the 10 px track that still count as hovering it. */
const HIT_SLOP_PX = 8;

const cell: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--fd-space-2)',
};

const hitArea: CSSProperties = {
  flex: '1 1 0px',
  minWidth: 0,
  padding: `${String(HIT_SLOP_PX)}px 0`,
  margin: `-${String(HIT_SLOP_PX)}px 0`,
};

const track: CSSProperties = {
  height: '10px',
  borderRadius: 'var(--fd-radius-pill)',
  background: 'var(--fd-line)',
  overflow: 'hidden',
};

const share: CSSProperties = {
  flex: 'none',
  minWidth: '36px',
  fontSize: 'var(--fd-text-xs)',
  color: 'var(--fd-muted)',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};

const amount: CSSProperties = {
  flex: 'none',
  minWidth: '48px',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};

interface Anchor {
  x: number;
  top: number;
}

function ShareTooltip({
  anchor,
  label,
  color,
  text,
}: {
  anchor: Anchor;
  label: string;
  color: string;
  text: string;
}): ReactElement {
  return (
    <span
      data-tooltip=""
      aria-hidden="true"
      style={{
        ...chartTooltip,
        position: 'fixed',
        left: anchor.x,
        top: anchor.top,
        transform: 'translate(-50%, calc(-100% - var(--fd-space-2)))',
      }}
    >
      <span
        style={{
          ...chartTooltipLabel,
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--fd-space-2)',
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: color,
          }}
        />
        {label}
      </span>
      <span style={chartTooltipValue}>{text}</span>
    </span>
  );
}

function ShareTrack({
  percent,
  color,
  onHover,
}: {
  percent: number;
  color: string;
  onHover: (anchor: Anchor | null) => void;
}): ReactElement {
  return (
    <div
      aria-hidden="true"
      data-bar-hit=""
      style={hitArea}
      onPointerEnter={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        onHover({ x: box.left + box.width / 2, top: box.top + HIT_SLOP_PX });
      }}
      onPointerLeave={() => {
        onHover(null);
      }}
    >
      <div data-bar-track="" style={track}>
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
    </div>
  );
}

/**
 * A table cell whose bar is the row's share of the column total, so the
 * bars of a column add up to the whole track.
 */
export function BarCell({
  label,
  counts,
  costUsd,
  unknownPriceCalls = 0,
  total,
  color,
}: BarCellProps): ReactElement {
  const value = totalTokens(counts);
  const percent = barPercent(value, total);
  const text = shareText(value, total);
  const [anchor, setAnchor] = useHoverAnchor<Anchor>();
  return (
    <div style={cell}>
      <ShareTrack percent={percent} color={color} onHover={setAnchor} />
      {anchor !== null ? (
        <ShareTooltip
          anchor={anchor}
          label={label}
          color={color}
          text={`${text} of ${formatTokens(total)} tokens`}
        />
      ) : null}
      <span data-share="" style={share}>
        {text}
      </span>
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
