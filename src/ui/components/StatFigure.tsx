import type { CSSProperties, ReactElement } from 'react';
import { visuallyHidden } from './chart-math.ts';
import {
  type BetterDirection,
  type Change,
  type FigureKind,
  type Noun,
  changeText,
  countText,
  isEnough,
} from './stats-math.ts';

export interface StatFigureProps {
  label: string;
  value: number | null;
  format: (value: number) => string;
  kind: FigureKind;
  n: number;
  noun: Noun;
  previous?: number | null | undefined;
  previousN?: number | undefined;
  comparison?: string;
  better?: BetterDirection;
  note?: string;
}

const figure: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  minWidth: 0,
};

const labelStyle: CSSProperties = {
  fontSize: '13px',
  color: 'var(--fd-muted)',
};

const valueStyle: CSSProperties = {
  fontFamily: 'var(--fd-font-display)',
  fontSize: 'var(--fd-title-md)',
  fontWeight: 600,
  lineHeight: 1.2,
  color: 'var(--fd-ink)',
  fontVariantNumeric: 'tabular-nums',
};

const small: CSSProperties = {
  fontSize: '12px',
  fontVariantNumeric: 'tabular-nums',
};

const TONE_COLOR: Record<Change['tone'], string> = {
  better: 'var(--fd-success)',
  worse: 'var(--fd-danger)',
  none: 'var(--fd-muted)',
};

function ChangeLine({ change }: { change: Change }): ReactElement {
  const style = { ...small, color: TONE_COLOR[change.tone] };
  if (change.direction === null) {
    return (
      <span data-change="" style={style}>
        {change.text}
      </span>
    );
  }
  return (
    <span data-change="" style={style}>
      <span aria-hidden="true">{change.direction === 'up' ? '▲' : '▼'}</span>
      <span style={visuallyHidden}>{change.direction}</span> {change.detail}
    </span>
  );
}

export function StatFigure({
  label,
  value,
  format,
  kind,
  n,
  noun,
  previous,
  previousN,
  comparison = '',
  better = 'higher',
  note,
}: StatFigureProps): ReactElement {
  const shown = value !== null && isEnough(n) ? value : null;
  const change =
    shown === null
      ? null
      : changeText({
          kind,
          value: shown,
          n,
          previous,
          previousN,
          comparison,
          better,
        });
  return (
    <div style={figure}>
      <span style={labelStyle}>{label}</span>
      <span data-value="" style={valueStyle}>
        {shown === null ? '—' : format(shown)}
      </span>
      <span data-sample="" style={{ ...small, color: 'var(--fd-muted)' }}>
        {shown === null ? 'Not enough data' : `n = ${countText(n, noun)}`}
      </span>
      {change === null ? null : <ChangeLine change={change} />}
      {note === undefined ? null : (
        <span data-note="" style={{ ...small, color: 'var(--fd-ink-2)' }}>
          {note}
        </span>
      )}
    </div>
  );
}
