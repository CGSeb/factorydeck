import { formatCost, formatTokens } from '../format.ts';

export interface TokenCounts {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export type TooltipLine =
  | { kind: 'cost'; label: string; value: string }
  | { kind: 'note'; text: string }
  | { kind: 'count'; label: string; value: string };

export function totalTokens(counts: TokenCounts): number {
  return counts.input + counts.output + counts.cacheRead + counts.cacheWrite;
}

function costNote(
  costUsd: number | null,
  unknownPriceCalls: number,
): TooltipLine[] {
  if (costUsd === null) {
    return [{ kind: 'note', text: 'Price unknown for every call' }];
  }
  if (unknownPriceCalls <= 0) return [];
  const calls = unknownPriceCalls === 1 ? 'call' : 'calls';
  return [
    {
      kind: 'note',
      text: `Excludes ${String(unknownPriceCalls)} ${calls} with unknown price`,
    },
  ];
}

export function tooltipLines(
  counts: TokenCounts,
  costUsd: number | null,
  unknownPriceCalls = 0,
): TooltipLine[] {
  return [
    { kind: 'cost', label: 'Cost', value: formatCost(costUsd) },
    ...costNote(costUsd, unknownPriceCalls),
    { kind: 'count', label: 'Input', value: formatTokens(counts.input) },
    { kind: 'count', label: 'Output', value: formatTokens(counts.output) },
    {
      kind: 'count',
      label: 'Cache read',
      value: formatTokens(counts.cacheRead),
    },
    {
      kind: 'count',
      label: 'Cache write',
      value: formatTokens(counts.cacheWrite),
    },
  ];
}

export type TooltipSide = 'above' | 'below';

export interface AnchorBox {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface TooltipPosition {
  side: TooltipSide;
  top: number;
  left: number;
}

/**
 * Places a fixed-position tooltip next to its anchor: on the preferred side
 * unless only the other side fits, aligned on the anchor's right edge above
 * or its left edge below, then kept `margin` px inside the viewport.
 */
export interface TooltipLayout {
  anchor: AnchorBox;
  size: { width: number; height: number };
  viewport: { width: number; height: number };
  preferred: TooltipSide;
  margin: number;
}

export function placeTooltip({
  anchor,
  size,
  viewport,
  preferred,
  margin,
}: TooltipLayout): TooltipPosition {
  const fitsAbove = anchor.top - size.height >= margin;
  const fitsBelow = anchor.bottom + size.height <= viewport.height - margin;
  let side = preferred;
  if (preferred === 'above' && !fitsAbove && fitsBelow) side = 'below';
  if (preferred === 'below' && !fitsBelow && fitsAbove) side = 'above';
  const top = side === 'above' ? anchor.top - size.height : anchor.bottom;
  const aligned = side === 'above' ? anchor.right - size.width : anchor.left;
  const left = Math.max(
    margin,
    Math.min(aligned, viewport.width - margin - size.width),
  );
  return { side, top, left };
}
