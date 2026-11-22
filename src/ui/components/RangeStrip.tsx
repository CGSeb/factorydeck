import { type ReactElement, useRef, useState } from 'react';
import {
  chartTooltip,
  chartTooltipLabel,
  chartTooltipValue,
} from './chart-tooltip.ts';
import {
  DOTS_AREA_PX,
  FALLBACK_WIDTH_PX,
  MARK_ROW_PX,
  type Mark,
  PILL_HEIGHT_PX,
  centreAt,
  dotStyle,
  foldedStackOf,
  emptyStyle,
  lineStyle,
  levelCentre,
  markLabelStyle,
  markTickStyle,
  marksFor,
  pillStyle,
  small,
  toggled,
  tooltipPosition,
  useWidth,
} from './range-strip.ts';
import {
  type PlacedDot,
  type StackPill,
  isEnough,
  stackLayout,
} from './stats-math.ts';

export interface RangeItem {
  label: string;
  value: number;
  href: string;
}

export interface RangeStripProps {
  label: string;
  items: readonly RangeItem[];
  format: (value: number) => string;
}

function MarkView({
  mark,
  marksPx,
}: {
  mark: Mark;
  marksPx: number;
}): ReactElement {
  return (
    <span data-mark={mark.name}>
      <span aria-hidden="true" style={markTickStyle(mark, marksPx)} />
      <span data-mark-label="" data-row={mark.row} style={markLabelStyle(mark)}>
        {mark.text}
      </span>
    </span>
  );
}

function Tooltip({
  item,
  value,
  x,
  top,
  width,
}: {
  item: RangeItem;
  value: string;
  x: number;
  top: number;
  width: number;
}): ReactElement {
  return (
    <span
      data-tooltip=""
      aria-hidden="true"
      style={{
        ...chartTooltip,
        position: 'absolute',
        ...tooltipPosition(x, top, width),
      }}
    >
      <span style={chartTooltipLabel}>{item.label}</span>
      <span style={chartTooltipValue}>{value}</span>
    </span>
  );
}

function Pill({
  pill,
  active,
}: {
  pill: StackPill;
  active: boolean;
}): ReactElement {
  return (
    <span data-pill="" aria-hidden="true" style={pillStyle(pill, active)}>
      +{pill.hidden}
    </span>
  );
}

function Dot({
  dot,
  item,
  format,
  active,
  onHover,
  onFocus,
}: {
  dot: PlacedDot;
  item: RangeItem;
  format: (value: number) => string;
  active: boolean;
  onHover: (on: boolean) => void;
  onFocus: (on: boolean) => void;
}): ReactElement {
  return (
    <a
      href={item.href}
      aria-label={`${item.label}, ${format(item.value)}`}
      data-dot=""
      data-folded={dot.folded ? '' : undefined}
      onPointerEnter={() => {
        onHover(true);
      }}
      onPointerLeave={() => {
        onHover(false);
      }}
      onFocus={() => {
        onFocus(true);
      }}
      onBlur={() => {
        onFocus(false);
      }}
      style={dotStyle(dot, active)}
    />
  );
}

function Baseline({ empty }: { empty: boolean }): ReactElement {
  if (empty) {
    return (
      <div data-empty="" style={emptyStyle}>
        No data
      </div>
    );
  }
  return <div data-line="" aria-hidden="true" style={lineStyle} />;
}

function Footer({
  items,
  largest,
  format,
}: {
  items: number;
  largest: number;
  format: (value: number) => string;
}): ReactElement | null {
  if (items === 0) return null;
  return (
    <>
      <div
        data-axis=""
        style={{
          ...small,
          display: 'flex',
          justifyContent: 'space-between',
          color: 'var(--fd-muted)',
        }}
      >
        <span>0</span>
        <span>{format(largest)}</span>
      </div>
      {isEnough(items) ? null : (
        <p
          data-notice=""
          style={{ ...small, margin: 0, color: 'var(--fd-muted)' }}
        >
          Not enough data for median and p90
        </p>
      )}
    </>
  );
}

function Dots({
  ordered,
  width,
  largest,
  format,
}: {
  ordered: readonly RangeItem[];
  width: number;
  largest: number;
  format: (value: number) => string;
}): ReactElement {
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const active = hovered ?? focused;
  const { dots, pills } = stackLayout(
    ordered.map((item) => centreAt(item.value, largest, width)),
  );
  const activeDot = active === null ? undefined : dots[active];
  const activeItem =
    activeDot === undefined ? undefined : ordered[activeDot.item];
  const foldedStack = foldedStackOf(dots, focused);
  return (
    <>
      {dots.map((dot) => {
        const item = ordered[dot.item];
        return item === undefined ? null : (
          <Dot
            key={`${String(dot.item)} ${item.href}`}
            dot={dot}
            item={item}
            format={format}
            active={hovered === dot.item || focused === dot.item}
            onHover={(on) => {
              setHovered((current) => toggled(current, dot.item, on));
            }}
            onFocus={(on) => {
              setFocused((current) => toggled(current, dot.item, on));
            }}
          />
        );
      })}
      {pills.map((pill) => (
        <Pill
          key={pill.stack}
          pill={pill}
          active={foldedStack === pill.stack}
        />
      ))}
      {activeDot !== undefined && activeItem !== undefined ? (
        <Tooltip
          item={activeItem}
          value={format(activeItem.value)}
          x={activeDot.x}
          top={levelCentre(activeDot.level) - PILL_HEIGHT_PX / 2}
          width={width}
        />
      ) : null}
    </>
  );
}

export function RangeStrip({
  label,
  items,
  format,
}: RangeStripProps): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const measured = useWidth(ref);
  const width = measured > 0 ? measured : FALLBACK_WIDTH_PX;
  const ordered = [...items].sort((a, b) => a.value - b.value);
  const values = ordered.map((item) => item.value);
  const largest = values.reduce((max, value) => Math.max(max, value), 0);
  const marks = marksFor(values, largest, width, format);
  const marksPx =
    Math.max(1, ...marks.map((mark) => mark.row + 1)) * MARK_ROW_PX;
  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      style={{ position: 'relative', minWidth: 0 }}
    >
      <div
        style={{
          position: 'relative',
          height: `${String(marksPx + DOTS_AREA_PX)}px`,
        }}
      >
        {marks.map((mark) => (
          <MarkView key={mark.name} mark={mark} marksPx={marksPx} />
        ))}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: `${String(marksPx)}px`,
            height: `${String(DOTS_AREA_PX)}px`,
          }}
        >
          <Baseline empty={ordered.length === 0} />
          <Dots
            ordered={ordered}
            width={width}
            largest={largest}
            format={format}
          />
        </div>
      </div>
      <Footer items={ordered.length} largest={largest} format={format} />
    </div>
  );
}
