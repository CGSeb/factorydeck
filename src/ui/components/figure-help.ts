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
