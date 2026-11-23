import type { Period } from '../overview/types.ts';
import type {
  AutonomyCounts,
  AutonomyReasons,
  AutonomyWeek,
  QualityCounts,
  QualityWeek,
} from '../stats/types.ts';
import type { CountRow } from './components/CountBars.tsx';
import { type TrendBucket, median } from './components/stats-math.ts';
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
