import { type CSSProperties, useEffect, useState } from 'react';

export const chartTooltip: CSSProperties = {
  zIndex: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  padding: 'var(--fd-space-2) var(--fd-space-3)',
  fontFamily: 'var(--fd-font-body)',
  fontSize: 'var(--fd-text-sm)',
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
  textAlign: 'left',
  color: 'var(--fd-tooltip-ink)',
  background: 'var(--fd-tooltip-bg)',
  borderRadius: 'var(--fd-radius-card)',
  boxShadow: 'var(--fd-shadow-tooltip)',
  pointerEvents: 'none',
};

export const tooltipAlign: Record<'start' | 'center' | 'end', CSSProperties> = {
  start: { left: 0 },
  center: { left: '50%', transform: 'translateX(-50%)' },
  end: { right: 0 },
};

export const chartTooltipLabel: CSSProperties = {
  fontSize: 'var(--fd-text-xs)',
  color: 'var(--fd-tooltip-muted)',
};

export const chartTooltipValue: CSSProperties = {
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
};

/**
 * Hover state for a fixed-position chart tooltip. Scrolling clears it,
 * since a fixed tooltip would otherwise stay where the hovered mark was.
 */
export function useHoverAnchor<T>(): [T | null, (next: T | null) => void] {
  const [hovered, setHovered] = useState<T | null>(null);
  useEffect(() => {
    if (hovered === null) return undefined;
    function clear(): void {
      setHovered(null);
    }
    window.addEventListener('scroll', clear, true);
    return () => {
      window.removeEventListener('scroll', clear, true);
    };
  }, [hovered]);
  return [hovered, setHovered];
}
