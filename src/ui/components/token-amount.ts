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

export interface HorizontalBox {
  left: number;
  right: number;
}

export function shiftIntoView(
  box: HorizontalBox,
  viewportWidth: number,
  margin: number,
): number {
  const overflowRight = box.right - (viewportWidth - margin);
  if (overflowRight > 0) return Math.max(margin - box.left, -overflowRight);
  if (box.left < margin) return margin - box.left;
  return 0;
}
