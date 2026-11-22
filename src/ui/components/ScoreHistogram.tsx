import { type CSSProperties, type ReactElement, useState } from 'react';
import { COLUMN_STUB_PX, visuallyHidden } from './chart-math.ts';
import {
  SCORE_BIN_COUNT,
  type ScoreBin,
  type ScoreReport,
  type TooltipAlign,
  alignAt,
  belowText,
  binSummary,
  isEnough,
  reportCount,
  scoreBins,
  thresholdText,
} from './stats-math.ts';
import { ColumnTooltip } from './TrendBars.tsx';

export interface ScoreHistogramProps {
  label: string;
  reports: readonly ScoreReport[];
  height?: number;
}

const TOP_ROW_PX = 18;

const small: CSSProperties = {
  fontSize: 'var(--fd-text-xs)',
  color: 'var(--fd-muted)',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
};

const columns: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: '2px',
  height: '100%',
};

const column: CSSProperties = {
  position: 'relative',
  flex: '1 1 0px',
  minWidth: 0,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
};

function edgeStyle(percent: number): CSSProperties {
  if (percent < 15) return { left: 0 };
  if (percent > 85) return { right: 0 };
  return { left: `${String(percent)}%`, transform: 'translateX(-50%)' };
}

function binHeight(bin: ScoreBin, largest: number, height: number): number {
  return bin.total > 0 && largest > 0
    ? Math.max(COLUMN_STUB_PX, (bin.total / largest) * height)
    : COLUMN_STUB_PX;
}

interface ColumnProps {
  bin: ScoreBin;
  total: number;
  hovered: boolean;
  dimmed: boolean;
  align: TooltipAlign;
  onHover: (hovered: boolean) => void;
}

function BinColumn({
  bin,
  total,
  hovered,
  dimmed,
  align,
  onHover,
}: ColumnProps): ReactElement {
  const below = bin.total > 0 ? (bin.below / bin.total) * total : 0;
  return (
    <div
      style={column}
      onPointerEnter={() => {
        onHover(true);
      }}
      onPointerLeave={() => {
        onHover(false);
      }}
    >
      {hovered ? (
        <ColumnTooltip
          lines={[bin.label, binSummary(bin)]}
          bottom={total}
          align={align}
        />
      ) : null}
      <div
        data-column=""
        style={{
          display: 'flex',
          flexDirection: 'column-reverse',
          width: '100%',
          height: `${String(total)}px`,
          overflow: 'hidden',
          borderRadius: '4px 4px 0 0',
          background: bin.total === 0 ? 'var(--fd-line)' : 'var(--fd-success)',
          opacity: dimmed ? 0.45 : 1,
          transition: 'opacity 120ms ease',
        }}
      >
        {bin.below > 0 ? (
          <div
            data-below=""
            style={{
              flex: 'none',
              height: `${String(below)}px`,
              background: 'var(--fd-warning)',
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function ThresholdLine({ threshold }: { threshold: number }): ReactElement {
  return (
    <div
      data-threshold=""
      style={{
        position: 'absolute',
        top: `-${String(TOP_ROW_PX / 3)}px`,
        bottom: 0,
        left: `${String(threshold)}%`,
        width: '1px',
        background: 'var(--fd-ink-2)',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  );
}

function Bins({
  bins,
  height,
  threshold,
}: {
  bins: readonly ScoreBin[];
  height: number;
  threshold: number | null;
}): ReactElement {
  const [hovered, setHovered] = useState<number | null>(null);
  const largest = bins.reduce((max, bin) => Math.max(max, bin.total), 0);
  return (
    <div style={{ position: 'relative', height: `${String(height)}px` }}>
      <div style={columns}>
        {bins.map((bin, index) => (
          <BinColumn
            key={bin.label}
            bin={bin}
            total={binHeight(bin, largest, height)}
            hovered={hovered === index}
            dimmed={hovered !== null && hovered !== index}
            align={alignAt((index + 0.5) / SCORE_BIN_COUNT)}
            onHover={(on) => {
              setHovered((current) =>
                on ? index : current === index ? null : current,
              );
            }}
          />
        ))}
      </div>
      {threshold === null ? null : <ThresholdLine threshold={threshold} />}
    </div>
  );
}

function ThresholdLabel({
  threshold,
  varied,
}: {
  threshold: number | null;
  varied: boolean;
}): ReactElement {
  return (
    <div style={{ position: 'relative', height: `${String(TOP_ROW_PX)}px` }}>
      {threshold === null ? null : (
        <span
          data-threshold-label=""
          style={{
            ...small,
            position: 'absolute',
            top: 0,
            color: 'var(--fd-ink-2)',
            ...edgeStyle(threshold),
          }}
        >
          {thresholdText(threshold, varied)}
        </span>
      )}
    </div>
  );
}

function NotEnough({ height }: { height: number }): ReactElement {
  return (
    <div
      data-empty=""
      style={{
        ...small,
        height: `${String(height)}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      Not enough data
    </div>
  );
}

const tick: CSSProperties = { position: 'absolute' };

function Axis(): ReactElement {
  return (
    <div
      data-axis=""
      style={{
        ...small,
        position: 'relative',
        height: '16px',
        marginTop: 'var(--fd-space-1)',
      }}
    >
      <span style={{ ...tick, left: 0 }}>0</span>
      <span style={{ ...tick, left: '50%', transform: 'translateX(-50%)' }}>
        50
      </span>
      <span style={{ ...tick, right: 0 }}>100</span>
    </div>
  );
}

function HiddenTable({
  label,
  bins,
  threshold,
  varied,
}: {
  label: string;
  bins: readonly ScoreBin[];
  threshold: number | null;
  varied: boolean;
}): ReactElement {
  return (
    <div style={visuallyHidden}>
      <table aria-label={label}>
        <tbody>
          {bins
            .filter((bin) => bin.total > 0)
            .map((bin) => (
              <tr key={bin.label}>
                <th scope="row">{bin.label}</th>
                <td>{reportCount(bin.total)}</td>
                <td>{belowText(bin.below)}</td>
              </tr>
            ))}
        </tbody>
      </table>
      {threshold === null ? null : <p>{thresholdText(threshold, varied)}</p>}
    </div>
  );
}

export function ScoreHistogram({
  label,
  reports,
  height = 80,
}: ScoreHistogramProps): ReactElement {
  const enough = isEnough(reports.length);
  const { bins, latestThreshold, varied } = scoreBins(reports);
  const threshold =
    enough && latestThreshold !== null
      ? Math.min(100, Math.max(0, latestThreshold))
      : null;
  return (
    <div style={{ position: 'relative', minWidth: 0 }}>
      <div role="img" aria-label={label}>
        <ThresholdLabel threshold={threshold} varied={varied} />
        {enough ? (
          <Bins bins={bins} height={height} threshold={threshold} />
        ) : (
          <NotEnough height={height} />
        )}
        <Axis />
      </div>
      {enough ? (
        <HiddenTable
          label={label}
          bins={bins}
          threshold={threshold}
          varied={varied}
        />
      ) : (
        <p style={visuallyHidden}>Not enough data</p>
      )}
    </div>
  );
}
