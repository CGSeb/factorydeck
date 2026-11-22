import type { CSSProperties, ReactElement } from 'react';
import { barPercent, shareText } from './chart-math.ts';
import { type Noun, countText, isEnough } from './stats-math.ts';

export interface CountRow {
  label: string;
  count: number;
}

export interface CountBarsProps {
  rows: readonly CountRow[];
  total: number;
  noun: Noun;
}

const list: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 3fr) minmax(48px, 2fr) auto',
  columnGap: 'var(--fd-space-3)',
  rowGap: 'var(--fd-space-2)',
  margin: 0,
  padding: 0,
  listStyle: 'none',
};

const row: CSSProperties = {
  display: 'grid',
  gridColumn: '1 / -1',
  gridTemplateColumns: 'subgrid',
  alignItems: 'center',
  fontSize: 'var(--fd-text-sm)',
};

const labelStyle: CSSProperties = {
  minWidth: 0,
  overflowWrap: 'anywhere',
  color: 'var(--fd-ink)',
};

const track: CSSProperties = {
  height: '10px',
  borderRadius: 'var(--fd-radius-pill)',
  background: 'var(--fd-line)',
  overflow: 'hidden',
};

const figure: CSSProperties = {
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
  color: 'var(--fd-ink-2)',
};

function sortedRows(rows: readonly CountRow[]): CountRow[] {
  return rows
    .map((item, index) => ({ item, index }))
    .sort((a, b) => b.item.count - a.item.count || a.index - b.index)
    .map(({ item }) => item);
}

export function CountBars({ rows, total, noun }: CountBarsProps): ReactElement {
  const enough = isEnough(total);
  return (
    <div style={{ minWidth: 0 }}>
      <ul style={list}>
        {sortedRows(rows).map((item, index) => {
          const width = enough ? barPercent(item.count, total) : 0;
          return (
            <li key={`${String(index)} ${item.label}`} style={row}>
              <span style={labelStyle}>{item.label}</span>
              <span data-track="" aria-hidden="true" style={track}>
                {width > 0 ? (
                  <span
                    data-bar=""
                    style={{
                      display: 'block',
                      height: '100%',
                      width: `${String(width)}%`,
                      borderRadius: 'var(--fd-radius-pill)',
                      background: 'var(--fd-warning)',
                    }}
                  />
                ) : null}
              </span>
              <span data-figure="" style={figure}>
                {enough
                  ? `${String(item.count)} · ${shareText(item.count, total)}`
                  : 'Not enough data'}
              </span>
            </li>
          );
        })}
      </ul>
      <p
        data-among=""
        style={{
          margin: 'var(--fd-space-2) 0 0',
          fontSize: '12px',
          color: 'var(--fd-muted)',
        }}
      >
        among {countText(total, noun)}
      </p>
    </div>
  );
}
