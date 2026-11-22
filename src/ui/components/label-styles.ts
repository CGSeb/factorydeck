import type { CSSProperties } from 'react';

export type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

export function pillStyle(tone: Tone): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    borderRadius: 'var(--fd-radius-pill)',
    fontSize: 'var(--fd-text-xs)',
    fontWeight: 600,
    padding: '3px 9px',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
    background: `var(--fd-${tone}-bg)`,
    color: `var(--fd-${tone})`,
  };
}

export function dotStyle(
  size: number,
  radius: string,
  background: string,
): CSSProperties {
  return {
    display: 'inline-block',
    flex: 'none',
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: radius,
    background,
  };
}

export const tagStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
};
