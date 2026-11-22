import type { CSSProperties, ReactElement } from 'react';
import { WHITE } from '../colors.ts';
import {
  type ChartSegment,
  MIN_SEGMENT_PX,
  SEGMENT_GAP_PX,
  SHARE_MIN_WIDTH_PX,
  splitParts,
  visuallyHidden,
} from './chart-math.ts';

export type SplitBarHeight = 'thin' | 'medium' | 'tall';

export interface SplitBarProps {
  label: string;
  segments: readonly ChartSegment[];
  height: SplitBarHeight;
}

const HEIGHT_PX: Record<SplitBarHeight, number> = {
  thin: 8,
  medium: 12,
  tall: 40,
};

const SHARE_CLASS = 'fd-split-bar-share';

const SHARE_CSS = `.${SHARE_CLASS}{display:none}@container (min-width: ${String(SHARE_MIN_WIDTH_PX)}px){.${SHARE_CLASS}{display:block}}`;

const share: CSSProperties = {
  color: WHITE,
  fontSize: '12px',
  fontWeight: 600,
  lineHeight: 1,
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
};

function trackStyle(heightPx: number, empty: boolean): CSSProperties {
  return {
    display: 'flex',
    gap: `${String(SEGMENT_GAP_PX)}px`,
    width: '100%',
    height: `${String(heightPx)}px`,
    borderRadius: `${String(heightPx / 2)}px`,
    overflow: 'hidden',
    background: empty ? 'var(--fd-line)' : undefined,
  };
}

function segmentStyle(weight: number, color: string): CSSProperties {
  return {
    flex: `${String(weight)} 1 0px`,
    minWidth: `${String(MIN_SEGMENT_PX)}px`,
    background: color,
    containerType: 'inline-size',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  };
}

export function SplitBar({
  label,
  segments,
  height,
}: SplitBarProps): ReactElement {
  const parts = splitParts(segments);
  const heightPx = HEIGHT_PX[height];
  return (
    <div role="group" aria-label={label} style={{ position: 'relative' }}>
      {height === 'tall' ? (
        <style href={SHARE_CLASS} precedence="default">
          {SHARE_CSS}
        </style>
      ) : null}
      <div aria-hidden="true" style={trackStyle(heightPx, parts.length === 0)}>
        {parts.map((part, index) => (
          <div
            key={`${String(index)} ${part.label}`}
            data-segment={part.label}
            style={segmentStyle(part.weight, part.color)}
          >
            {height === 'tall' ? (
              <span className={SHARE_CLASS} style={share}>
                {part.share}%
              </span>
            ) : null}
          </div>
        ))}
      </div>
      {parts.length > 0 ? (
        <ul style={visuallyHidden}>
          {parts.map((part, index) => (
            <li key={`${String(index)} ${part.label}`}>
              {part.label} {part.share}%
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
