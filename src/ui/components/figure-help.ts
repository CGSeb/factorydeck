export const HELP_GAP = 6;
export const VIEWPORT_MARGIN = 8;
export const HELP_WIDTH = 260;

export function helpLeft(
  anchor: { left: number; width: number },
  tooltipWidth: number,
  viewportWidth: number,
): number {
  const centred = anchor.left + anchor.width / 2 - tooltipWidth / 2;
  const max = viewportWidth - VIEWPORT_MARGIN - tooltipWidth;
  return Math.max(VIEWPORT_MARGIN, Math.min(centred, max));
}

export type HelpSide = 'below' | 'above';

export function helpTop(
  anchor: { top: number; bottom: number },
  tooltipHeight: number,
  viewportHeight: number,
): { top: number; side: HelpSide } {
  const below = anchor.bottom + HELP_GAP;
  const lowest = viewportHeight - VIEWPORT_MARGIN - tooltipHeight;
  if (below <= lowest) return { top: below, side: 'below' };
  const above = anchor.top - HELP_GAP - tooltipHeight;
  if (above >= VIEWPORT_MARGIN) return { top: above, side: 'above' };
  return { top: Math.max(VIEWPORT_MARGIN, lowest), side: 'below' };
}
