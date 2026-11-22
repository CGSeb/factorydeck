import type { CSSProperties } from 'react';

export const page: CSSProperties = {
  background: 'var(--fd-page)',
  color: 'var(--fd-ink)',
  fontFamily: 'var(--fd-font-body)',
  fontSize: 'var(--fd-text-md)',
  padding: 'var(--fd-space-6)',
  minHeight: '100vh',
  boxSizing: 'border-box',
  alignContent: 'start',
  display: 'grid',
  gap: 'var(--fd-space-6)',
};

export const heading: CSSProperties = {
  fontFamily: 'var(--fd-font-display)',
  fontSize: 'var(--fd-title-sm)',
  margin: 0,
};

export const grid: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: 'var(--fd-space-3)',
};

export const card: CSSProperties = {
  background: 'var(--fd-surface)',
  border: '1px solid var(--fd-border)',
  borderRadius: 'var(--fd-radius-card)',
  padding: 'var(--fd-space-3)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--fd-space-3)',
};

export const code: CSSProperties = {
  fontFamily: 'var(--fd-font-mono)',
  fontSize: 'var(--fd-text-xs)',
  color: 'var(--fd-muted)',
};

export const rows: CSSProperties = { ...grid, gridTemplateColumns: '1fr' };
