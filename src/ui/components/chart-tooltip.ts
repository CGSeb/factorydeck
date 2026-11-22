import type { CSSProperties } from 'react';

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

export const chartTooltipLabel: CSSProperties = {
  fontSize: 'var(--fd-text-xs)',
  color: 'var(--fd-tooltip-muted)',
};

export const chartTooltipValue: CSSProperties = {
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
};
