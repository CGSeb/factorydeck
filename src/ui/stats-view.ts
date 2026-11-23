import type { Period } from '../overview/types.ts';
import type {
  AutonomyCounts,
  AutonomyReasons,
  AutonomyWeek,
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
