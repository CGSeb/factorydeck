import type { Period } from '../overview/types.ts';
import type {
  AutonomyCounts,
  AutonomyReasons,
  AutonomyBucket,
  FlowBucket,
  FlowIssue,
  FlowStripIssue,
  FlowTokens,
  QualityBucket,
  QualityCounts,
  TrendUnit,
} from '../stats/types.ts';
import type { CountRow } from './components/CountBars.tsx';
import type { RangeItem } from './components/RangeStrip.tsx';
import { type TrendBucket, median } from './components/stats-math.ts';
import { featurePath } from './features-api.ts';
import { MONTHS, formatBucket } from './format.ts';

const COMPARISONS: Record<Exclude<Period, 'all'>, string> = {
  today: 'yesterday',
  '7d': 'previous 7 days',
  '30d': 'previous 30 days',
};

export function comparisonText(period: Period): string | undefined {
  return period === 'all' ? undefined : COMPARISONS[period];
}

function plural(count: number, one: string, other: string): string {
  return `${String(count)} ${count === 1 ? one : other}`;
}

export function autonomySummary({
  merged,
  mergedWithoutPerson,
}: AutonomyCounts): string {
  if (merged === 0) return 'No issue merged';
  return `${plural(merged, 'issue', 'issues')} merged · ${String(mergedWithoutPerson)} without a person`;
}

export function shareOf(part: number, total: number): number | null {
  return total === 0 ? null : part / total;
}

export function wholePercent(value: number): string {
  return `${String(Math.round(value * 100))}%`;
}

export interface AutonomyFigures {
  withoutPerson: number | null;
  specQuestions: number | null;
  waiting: number | null;
}

export function autonomyFigures(counts: AutonomyCounts): AutonomyFigures {
  return {
    withoutPerson: shareOf(counts.mergedWithoutPerson, counts.merged),
    specQuestions: shareOf(counts.mergedAfterQuestion, counts.merged),
    waiting: counts.merged === 0 ? null : median(counts.answeredWaitsMs),
  };
}

export function waitingNote(waiting: number): string | undefined {
  return waiting === 0 ? undefined : `${String(waiting)} still waiting`;
}

export interface Trend<Bucket> {
  unit: TrendUnit;
  buckets: readonly Bucket[];
}

const CURRENT_LABELS: Record<TrendUnit, string> = {
  hour: 'this hour',
  day: 'today',
  week: 'this week',
  month: 'this month',
  year: 'this year',
};

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

export function hourKey(now: Date): string {
  return `${String(now.getFullYear())}-${twoDigits(now.getMonth() + 1)}-${twoDigits(now.getDate())}T${twoDigits(now.getHours())}:00`;
}

export function trendTitle(base: string, unit: TrendUnit): string {
  return `${base}, by ${unit}`;
}

export function mergedTitle(unit: TrendUnit): string {
  return `Merged per ${unit}`;
}

function bucketLabel(unit: TrendUnit, start: string): string {
  const [year = '', month = 1] = start.split('-');
  if (unit === 'year') return year;
  if (unit === 'month') {
    return `${MONTHS[Number(month) - 1] ?? ''} ${year}`;
  }
  return formatBucket(start);
}

function currentIndex(
  { unit, buckets }: Trend<{ start: string }>,
  now: Date,
): number {
  if (unit !== 'hour') return buckets.length - 1;
  const key = hourKey(now);
  return buckets.findLastIndex((bucket) => bucket.start === key);
}

export function trendLabels(
  trend: Trend<{ start: string }>,
  now: Date,
): string[] {
  const current = currentIndex(trend, now);
  return trend.buckets.map((bucket, index) =>
    index === current
      ? CURRENT_LABELS[trend.unit]
      : bucketLabel(trend.unit, bucket.start),
  );
}

export function autonomyBuckets(
  trend: Trend<AutonomyBucket>,
  now: Date,
): TrendBucket[] {
  const labels = trendLabels(trend, now);
  return trend.buckets.map((bucket, index) => {
    const value = shareOf(bucket.mergedWithoutPerson, bucket.merged);
    return {
      label: labels[index] ?? '',
      value,
      n: bucket.merged,
      text:
        value === null
          ? 'No issue merged'
          : `${wholePercent(value)} · ${String(bucket.mergedWithoutPerson)} of ${String(bucket.merged)}`,
    };
  });
}

export function reasonRows(reasons: AutonomyReasons): CountRow[] {
  return [
    { label: 'Spec question', count: reasons.specQuestion },
    { label: 'Score below threshold', count: reasons.belowThreshold },
    { label: 'Gates failed', count: reasons.gatesFailed },
    { label: 'Auto-merge off', count: reasons.autoMergeOff },
  ];
}

export function oneDecimal(value: number): string {
  return value.toFixed(1);
}

export interface QualityFigures {
  firstTime: number | null;
  rounds: number | null;
  reworked: number | null;
  closedWithoutMerge: number | null;
}

export function qualityFigures(counts: QualityCounts): QualityFigures {
  return {
    firstTime: shareOf(counts.firstPassed, counts.mergedWithReport),
    rounds:
      counts.roundsCount === 0 ? null : counts.roundsSum / counts.roundsCount,
    reworked: shareOf(counts.reworked, counts.merged),
    closedWithoutMerge:
      counts.merged === 0
        ? null
        : shareOf(counts.closedWithoutMerge, counts.ended),
  };
}

export function qualityBuckets(
  trend: Trend<QualityBucket>,
  now: Date,
): TrendBucket[] {
  const labels = trendLabels(trend, now);
  return trend.buckets.map((bucket, index) => {
    const value = shareOf(bucket.firstPassed, bucket.mergedWithReport);
    return {
      label: labels[index] ?? '',
      value,
      n: bucket.mergedWithReport,
      text:
        value === null
          ? 'No merged issue with a report'
          : `${wholePercent(value)} · ${String(bucket.firstPassed)} of ${String(bucket.mergedWithReport)}`,
    };
  });
}

export function mergedBuckets(
  trend: Trend<FlowBucket>,
  now: Date,
): TrendBucket[] {
  const labels = trendLabels(trend, now);
  return trend.buckets.map((bucket, index) => ({
    label: labels[index] ?? '',
    value: bucket.merged,
    text: plural(bucket.merged, 'issue', 'issues'),
  }));
}

function present(values: readonly (number | null)[]): number[] {
  return values.filter((value): value is number => value !== null);
}

export interface FlowSample {
  value: number | null;
  n: number;
}

export interface FlowFigures {
  lead: FlowSample;
  cycle: FlowSample;
  tokens: FlowSample;
}

function sampleOf(values: readonly number[]): FlowSample {
  return { value: median(values), n: values.length };
}

export function flowFigures(issues: readonly FlowIssue[]): FlowFigures {
  return {
    lead: sampleOf(issues.map((issue) => issue.leadMs)),
    cycle: sampleOf(present(issues.map((issue) => issue.cycleMs))),
    tokens: sampleOf(present(issues.map((issue) => issue.tokens))),
  };
}

export interface TokenShares {
  droppedWork: number | null;
  noWorkItem: number | null;
  cacheReads: number | null;
}

export function tokenShares(tokens: FlowTokens): TokenShares {
  return {
    droppedWork: shareOf(tokens.droppedWork, tokens.total),
    noWorkItem: shareOf(tokens.noWorkItem, tokens.total),
    cacheReads: shareOf(tokens.cacheRead, tokens.inputSide),
  };
}

export function issueLabel({ number, title }: FlowStripIssue): string {
  const name = `#${String(number)}`;
  return title.trim() === '' ? name : `${name} ${title}`;
}

export function stripItems(
  issues: readonly FlowStripIssue[],
  value: (issue: FlowStripIssue) => number | null,
  period: Period,
): RangeItem[] {
  return issues.flatMap((issue) => {
    const shown = value(issue);
    return shown === null
      ? []
      : [
          {
            label: issueLabel(issue),
            value: shown,
            href: featurePath(issue, { period }),
          },
        ];
  });
}

export interface Compared {
  previous?: number | null;
  previousN?: number;
  comparison?: string;
}

export function comparer(
  period: Period,
): (value: number | null | undefined, n: number | undefined) => Compared {
  const comparison = comparisonText(period);
  return (value, n) =>
    comparison === undefined || value === undefined || n === undefined
      ? {}
      : { previous: value, previousN: n, comparison };
}
