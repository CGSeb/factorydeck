import { COLUMN_STUB_PX } from './chart-math.ts';

export const MIN_SAMPLE = 5;

export const SCORE_BIN_COUNT = 20;
export const SCORE_BIN_WIDTH = 5;

export interface Noun {
  one: string;
  other: string;
}

export type FigureKind = 'share' | 'amount' | 'points';
export type BetterDirection = 'higher' | 'lower';

export interface ChangeInput {
  kind: FigureKind;
  value: number | null;
  n: number;
  previous?: number | null | undefined;
  previousN?: number | undefined;
  comparison: string;
  better: BetterDirection;
  count?: boolean;
}

export interface Change {
  direction: 'up' | 'down' | null;
  amount: string;
  comparison: string;
  tone: 'better' | 'worse' | 'none';
  detail: string;
  text: string;
}

export interface ScoreReport {
  score: number;
  threshold: number;
  time: string;
}

export interface ScoreBin {
  label: string;
  total: number;
  below: number;
}

export interface ScoreBins {
  bins: ScoreBin[];
  latestThreshold: number | null;
  varied: boolean;
}

export function isEnough(n: number): boolean {
  return n >= MIN_SAMPLE;
}

export function nounFor(n: number, noun: Noun): string {
  return n === 1 ? noun.one : noun.other;
}

export function countText(n: number, noun: Noun): string {
  return `${String(n)} ${nounFor(n, noun)}`;
}

function sorted(values: readonly number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const ordered = sorted(values);
  const middle = Math.floor(ordered.length / 2);
  const upper = ordered[middle] ?? 0;
  if (ordered.length % 2 === 1) return upper;
  const lower = ordered[middle - 1] ?? 0;
  return (lower + upper) / 2;
}

export function percentile(
  values: readonly number[],
  p: number,
): number | null {
  if (values.length === 0) return null;
  const ordered = sorted(values);
  const rank = Math.min(
    ordered.length,
    Math.max(1, Math.ceil((p * ordered.length) / 100)),
  );
  return ordered[rank - 1] ?? null;
}

function changeAmount(kind: FigureKind, rounded: number): string {
  const size = Math.abs(rounded);
  if (kind === 'amount') return `${String(size)}%`;
  return `${String(size)} ${size === 1 ? 'pt' : 'pts'}`;
}

function versus(comparison: string): string {
  return comparison === '' ? '' : ` vs ${comparison}`;
}

function changeBase(input: ChangeInput): [number, number] | null {
  const { value, previous, previousN } = input;
  const sampled = input.count !== true;
  if (value === null || (sampled && !isEnough(input.n))) return null;
  if (previous === undefined || previous === null) return null;
  if (sampled && previousN !== undefined && !isEnough(previousN)) return null;
  if (input.kind === 'amount' && previous === 0) return null;
  return [value, previous];
}

export function changeText(input: ChangeInput): Change | null {
  const { kind, comparison, better } = input;
  const base = changeBase(input);
  if (base === null) return null;
  const [value, previous] = base;
  const raw =
    kind === 'share'
      ? (value - previous) * 100
      : kind === 'points'
        ? value - previous
        : ((value - previous) / previous) * 100;
  const rounded = Math.round(raw);
  if (rounded === 0) {
    return {
      direction: null,
      amount: '',
      comparison,
      tone: 'none',
      detail: '',
      text: `No change${versus(comparison)}`,
    };
  }
  const direction = rounded > 0 ? 'up' : 'down';
  const amount = changeAmount(kind, rounded);
  const improved = (direction === 'up') === (better === 'higher');
  return {
    direction,
    amount,
    comparison,
    tone: improved ? 'better' : 'worse',
    detail: `${amount}${versus(comparison)}`,
    text: `${direction === 'up' ? '▲' : '▼'} ${amount}${versus(comparison)}`,
  };
}

export function scoreBinIndex(score: number): number {
  const clamped = Math.min(100, Math.max(0, score));
  return Math.min(SCORE_BIN_COUNT - 1, Math.floor(clamped / SCORE_BIN_WIDTH));
}

export function scoreBinLabel(index: number): string {
  const low = index * SCORE_BIN_WIDTH;
  const high = index === SCORE_BIN_COUNT - 1 ? 100 : low + SCORE_BIN_WIDTH - 1;
  return `${String(low)}–${String(high)}`;
}

export function isBelowThreshold(report: ScoreReport): boolean {
  return report.score < report.threshold;
}

function latestReport(reports: readonly ScoreReport[]): ScoreReport | null {
  let latest: ScoreReport | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;
  for (const report of reports) {
    const time = Date.parse(report.time);
    if (latest === null || time >= latestTime) {
      latest = report;
      latestTime = time;
    }
  }
  return latest;
}

export function scoreBins(reports: readonly ScoreReport[]): ScoreBins {
  const bins: ScoreBin[] = Array.from(
    { length: SCORE_BIN_COUNT },
    (_, index) => ({ label: scoreBinLabel(index), total: 0, below: 0 }),
  );
  for (const report of reports) {
    const bin = bins[scoreBinIndex(report.score)];
    if (bin === undefined) continue;
    bin.total += 1;
    if (isBelowThreshold(report)) bin.below += 1;
  }
  const latest = latestReport(reports);
  return {
    bins,
    latestThreshold: latest?.threshold ?? null,
    varied:
      latest !== null &&
      reports.some((report) => report.threshold !== latest.threshold),
  };
}

export type TooltipAlign = 'start' | 'center' | 'end';

export function alignAt(fraction: number): TooltipAlign {
  if (fraction < 1 / 3) return 'start';
  if (fraction > 2 / 3) return 'end';
  return 'center';
}

export interface TrendBucket {
  label: string;
  value: number | null;
  n?: number;
  text: string;
}

export type TrendScale = 'share' | 'count';

export type TrendDraw = 'empty' | 'small' | 'full';

export function trendDraw(bucket: TrendBucket): TrendDraw {
  if (bucket.value === null || bucket.n === 0) return 'empty';
  return bucket.n !== undefined && !isEnough(bucket.n) ? 'small' : 'full';
}

export function isDrawn(bucket: TrendBucket): bucket is TrendBucket & {
  value: number;
} {
  return trendDraw(bucket) !== 'empty';
}

export function trendHeights(
  buckets: readonly TrendBucket[],
  scale: TrendScale,
  height: number,
): number[] {
  const largest =
    scale === 'share'
      ? 1
      : buckets.reduce(
          (max, bucket) =>
            isDrawn(bucket) ? Math.max(max, bucket.value) : max,
          0,
        );
  return buckets.map((bucket) => {
    if (!isDrawn(bucket) || largest <= 0 || bucket.value <= 0) {
      return COLUMN_STUB_PX;
    }
    return Math.max(
      COLUMN_STUB_PX,
      Math.min(1, bucket.value / largest) * height,
    );
  });
}

export function reportCount(count: number): string {
  return `${String(count)} ${count === 1 ? 'report' : 'reports'}`;
}

export function belowText(below: number): string {
  return `${String(below)} below ${below === 1 ? 'its' : 'their'} threshold`;
}

export function binSummary(bin: ScoreBin): string {
  const total = reportCount(bin.total);
  return bin.below > 0 ? `${total} · ${belowText(bin.below)}` : total;
}

export function thresholdText(threshold: number, varied: boolean): string {
  return `threshold ${String(threshold)}${varied ? ' · varied' : ''}`;
}
