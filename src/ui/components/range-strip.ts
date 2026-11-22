import {
  type CSSProperties,
  type RefObject,
  useLayoutEffect,
  useState,
} from 'react';
import { visuallyHidden } from './chart-math.ts';
import {
  type PlacedDot,
  type StackPill,
  type TooltipAlign,
  alignAt,
  isEnough,
  median,
  percentile,
} from './stats-math.ts';

export interface LabelBox {
  centre: number;
  width: number;
}

export const LABEL_GAP_PX = 8;

export function labelLeft(box: LabelBox, containerWidth: number): number {
  const left = box.centre - box.width / 2;
  return Math.max(0, Math.min(left, containerWidth - box.width));
}

export function labelsOverlap(
  first: LabelBox,
  second: LabelBox,
  containerWidth: number,
): boolean {
  const a = labelLeft(first, containerWidth);
  const b = labelLeft(second, containerWidth);
  const [left, leftWidth, right] =
    a <= b ? [a, first.width, b] : [b, second.width, a];
  return left + leftWidth + LABEL_GAP_PX > right;
}

export const DOT_PX = 8;
export const LEVEL_PX = 10;
export const LINE_PX = 2;
export const PILL_HEIGHT_PX = 16;
export const DOTS_AREA_PX = 52;
export const LINE_Y_PX = 48;
export const MARK_ROW_PX = 16;
export const MARK_ROWS = 2;
export const FOOTER_ROWS = 2;
export const STRIP_HEIGHT_PX =
  (MARK_ROWS + FOOTER_ROWS) * MARK_ROW_PX + DOTS_AREA_PX;
export const FALLBACK_WIDTH_PX = 320;
const CHAR_WIDTH_PX = 7;

export interface Mark {
  name: string;
  text: string;
  x: number;
  row: number;
  left: number;
}

export function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return undefined;
    setWidth(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [ref]);
  return width;
}

export function centreAt(
  value: number,
  largest: number,
  width: number,
): number {
  if (largest <= 0) return DOT_PX / 2;
  return DOT_PX / 2 + (value / largest) * (width - DOT_PX);
}

export function levelCentre(level: number): number {
  return LINE_Y_PX - level * LEVEL_PX;
}

export function tooltipPosition(
  x: number,
  top: number,
  width: number,
): CSSProperties {
  const align: TooltipAlign = alignAt(width > 0 ? x / width : 0);
  const vertical = { top: `${String(top - 8)}px` };
  if (align === 'start') {
    return {
      ...vertical,
      left: `${String(Math.max(0, x - 12))}px`,
      transform: 'translateY(-100%)',
    };
  }
  if (align === 'end') {
    return {
      ...vertical,
      right: `${String(Math.max(0, width - x - 12))}px`,
      transform: 'translateY(-100%)',
    };
  }
  return {
    ...vertical,
    left: `${String(x)}px`,
    transform: 'translate(-50%, -100%)',
  };
}

function box(text: string, centre: number): LabelBox {
  return { centre, width: text.length * CHAR_WIDTH_PX };
}

export function marksFor(
  values: readonly number[],
  largest: number,
  width: number,
  format: (value: number) => string,
): Mark[] {
  if (!isEnough(values.length)) return [];
  const mid = median(values);
  const p90 = percentile(values, 90);
  if (mid === null || p90 === null) return [];
  const midText = `median ${format(mid)}`;
  const p90Text = `p90 ${format(p90)}`;
  const midBox = box(midText, centreAt(mid, largest, width));
  const p90Box = box(p90Text, centreAt(p90, largest, width));
  const overlap = labelsOverlap(midBox, p90Box, width);
  const p90Left = overlap
    ? Math.max(0, Math.min(p90Box.centre, width - p90Box.width))
    : labelLeft(p90Box, width);
  return [
    {
      name: 'median',
      text: midText,
      x: midBox.centre,
      row: 0,
      left: labelLeft(midBox, width),
    },
    {
      name: 'p90',
      text: p90Text,
      x: p90Box.centre,
      row: overlap ? 1 : 0,
      left: p90Left,
    },
  ];
}

export const small: CSSProperties = {
  fontSize: '12px',
  lineHeight: `${String(MARK_ROW_PX)}px`,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
};

export const ring = '0 0 0 2px var(--fd-surface), 0 0 0 4px var(--fd-accent)';

export function dotStyle(dot: PlacedDot, active: boolean): CSSProperties {
  if (dot.folded) return visuallyHidden;
  return {
    position: 'absolute',
    zIndex: 1,
    left: `${String(dot.x - DOT_PX / 2)}px`,
    top: `${String(levelCentre(dot.level) - DOT_PX / 2)}px`,
    width: `${String(DOT_PX)}px`,
    height: `${String(DOT_PX)}px`,
    borderRadius: '50%',
    background: 'var(--fd-ink-2)',
    outline: 'none',
    boxShadow: active ? ring : 'none',
  };
}

export function pillStyle(pill: StackPill, active: boolean): CSSProperties {
  return {
    ...small,
    position: 'absolute',
    zIndex: 1,
    left: `${String(pill.x)}px`,
    top: `${String(levelCentre(pill.level) - PILL_HEIGHT_PX / 2)}px`,
    transform: 'translateX(-50%)',
    height: `${String(PILL_HEIGHT_PX)}px`,
    padding: '0 6px',
    borderRadius: 'var(--fd-radius-pill)',
    color: 'var(--fd-ink-2)',
    background: 'var(--fd-surface-2)',
    boxShadow: active ? ring : 'none',
  };
}

export function markTickStyle(mark: Mark, marksPx: number): CSSProperties {
  const below = (mark.row + 1) * MARK_ROW_PX;
  return {
    position: 'absolute',
    left: `${String(mark.x)}px`,
    top: `${String(below)}px`,
    height: `${String(marksPx - below + LINE_Y_PX)}px`,
    width: '1px',
    background: 'var(--fd-ink)',
  };
}

export function markLabelStyle(mark: Mark): CSSProperties {
  return {
    ...small,
    position: 'absolute',
    left: `${String(mark.left)}px`,
    top: `${String(mark.row * MARK_ROW_PX)}px`,
    color: 'var(--fd-ink)',
  };
}

export const emptyStyle: CSSProperties = {
  ...small,
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--fd-muted)',
};

export const lineStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: `${String(LINE_Y_PX - LINE_PX / 2)}px`,
  height: `${String(LINE_PX)}px`,
  background: 'var(--fd-border)',
};

export function toggled(
  current: number | null,
  item: number,
  on: boolean,
): number | null {
  if (on) return item;
  return current === item ? null : current;
}

export function foldedStackOf(
  dots: readonly PlacedDot[],
  focused: number | null,
): number | null {
  const dot = focused === null ? undefined : dots[focused];
  return dot?.folded === true ? dot.stack : null;
}

export const footerRow: CSSProperties = {
  ...small,
  height: `${String(MARK_ROW_PX)}px`,
};

export const axisStyle: CSSProperties = {
  ...footerRow,
  display: 'flex',
  justifyContent: 'space-between',
  color: 'var(--fd-muted)',
};
