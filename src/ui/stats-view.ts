import type { Period } from '../overview/types.ts';
import type {
  AutonomyCounts,
  AutonomyReasons,
  AutonomyWeek,
  FlowIssue,
  FlowStripIssue,
  FlowTokens,
  FlowWeek,
  QualityCounts,
  QualityWeek,
} from '../stats/types.ts';
import type { CountRow } from './components/CountBars.tsx';
import type { RangeItem } from './components/RangeStrip.tsx';
import { type TrendBucket, median } from './components/stats-math.ts';
import { featurePath } from './features-api.ts';
import { formatBucket } from './format.ts';

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

export function weekBuckets(weeks: readonly AutonomyWeek[]): TrendBucket[] {
  return weeks.map((week, index) => {
    const value = shareOf(week.mergedWithoutPerson, week.merged);
    return {
      label:
        index === weeks.length - 1 ? 'this week' : formatBucket(week.start),
      value,
      n: week.merged,
      text:
        value === null
          ? 'No issue merged'
          : `${wholePercent(value)} · ${String(week.mergedWithoutPerson)} of ${String(week.merged)}`,
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

export function qualityWeekBuckets(
  weeks: readonly QualityWeek[],
): TrendBucket[] {
  return weeks.map((week, index) => {
    const value = shareOf(week.firstPassed, week.mergedWithReport);
    return {
      label:
        index === weeks.length - 1 ? 'this week' : formatBucket(week.start),
      value,
      n: week.mergedWithReport,
      text:
        value === null
          ? 'No merged issue with a report'
          : `${wholePercent(value)} · ${String(week.firstPassed)} of ${String(week.mergedWithReport)}`,
    };
  });
}

export function mergedWeekBuckets(weeks: readonly FlowWeek[]): TrendBucket[] {
  return weeks.map((week, index) => ({
    label: index === weeks.length - 1 ? 'this week' : formatBucket(week.start),
    value: week.merged,
    text: plural(week.merged, 'issue', 'issues'),
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
