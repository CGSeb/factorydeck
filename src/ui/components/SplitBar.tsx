import type { CSSProperties, ReactElement } from 'react';
import { labelTextColor } from '../colors.ts';
import {
  type ChartSegment,
  MIN_SEGMENT_PX,
  SEGMENT_GAP_PX,
  SHARE_MIN_WIDTH_PX,
  type SplitPart,
  splitParts,
  visuallyHidden,
} from './chart-math.ts';
import {
  chartTooltip,
  chartTooltipLabel,
  chartTooltipValue,
  useHoverAnchor,
} from './chart-tooltip.ts';

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

/** Extra px above and below the bar that still count as hovering it. */
const HIT_SLOP_PX = 6;

interface Hovered {
  index: number;
  x: number;
  top: number;
}

const tipLine: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--fd-space-2)',
};

function SegmentTooltip({
  part,
  hovered,
}: {
  part: SplitPart<ChartSegment>;
  hovered: Hovered;
}): ReactElement {
  return (
    <span
      data-tooltip=""
      aria-hidden="true"
      style={{
        ...chartTooltip,
        position: 'fixed',
        left: hovered.x,
        top: hovered.top,
        transform: 'translate(-50%, calc(-100% - var(--fd-space-2)))',
      }}
    >
      <span style={{ ...tipLine, ...chartTooltipLabel }}>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: part.color,
          }}
        />
        {part.label}
      </span>
      <span style={chartTooltipValue}>{part.share}%</span>
    </span>
  );
}

function HitZones({
  parts,
  onHover,
}: {
  parts: readonly SplitPart<ChartSegment>[];
  onHover: (hovered: Hovered | null) => void;
}): ReactElement {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: `-${String(HIT_SLOP_PX)}px 0`,
        display: 'flex',
        gap: `${String(SEGMENT_GAP_PX)}px`,
      }}
      onPointerLeave={() => {
        onHover(null);
      }}
    >
      {parts.map((part, index) => (
        <div
          key={`${String(index)} ${part.label}`}
          data-hit={part.label}
          style={{
            flex: `${String(part.weight)} 1 0px`,
            minWidth: `${String(MIN_SEGMENT_PX)}px`,
          }}
          onPointerEnter={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            onHover({
              index,
              x: box.left + box.width / 2,
              top: box.top + HIT_SLOP_PX,
            });
          }}
        />
      ))}
    </div>
  );
}

export function SplitBar({
  label,
  segments,
  height,
}: SplitBarProps): ReactElement {
  const parts = splitParts(segments);
  const heightPx = HEIGHT_PX[height];
  const [hovered, setHovered] = useHoverAnchor<Hovered>();
  const hoveredPart = hovered === null ? undefined : parts[hovered.index];
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
            style={{
              ...segmentStyle(part.weight, part.color),
              opacity: hovered !== null && hovered.index !== index ? 0.45 : 1,
              transition: 'opacity 120ms ease',
            }}
          >
            {height === 'tall' ? (
              <span
                className={SHARE_CLASS}
                style={{ ...share, color: labelTextColor(part.color) }}
              >
                {part.share}%
              </span>
            ) : null}
          </div>
        ))}
      </div>
      {parts.length > 0 ? (
        <HitZones parts={parts} onHover={setHovered} />
      ) : null}
      {hovered !== null && hoveredPart !== undefined ? (
        <SegmentTooltip part={hoveredPart} hovered={hovered} />
      ) : null}
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
