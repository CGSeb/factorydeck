import {
  type CompactionTrigger,
  FRICTION_KINDS,
  type FrictionSubject,
  type ThreadPeak,
  type FrictionCategory,
  type FrictionKind,
  type FrictionStats,
  type FrictionWeek,
  type KindCounts,
} from '../frictions/types.ts';
import type { FilterOption } from './components/FilterPills.tsx';
import type { TrendBucket } from './components/stats-math.ts';
import { issueTitleText } from './components/IssueCard.tsx';
import type { FrictionFilters } from './frictions-api.ts';
import { MISSING, formatBucket, formatCount, formatTokens } from './format.ts';
import { sessionTitle } from './session-links.ts';

export const ALL_KINDS = 'all';

export type KindChoice = FrictionKind | typeof ALL_KINDS;

export const MAX_EXIT_CODES = 5;

export const API_CALL_NOUN = { one: 'API call', other: 'API calls' };

export const KIND_LABELS: Record<FrictionKind, string> = {
  'tool-error': 'Tool errors',
  'stop-blocked': 'Stop blocked',
  compaction: 'Compactions',
};

export const CATEGORY_LABELS: Record<FrictionCategory, string> = {
  'permission-denied': 'Permission denied',
  'hook-blocked': 'Blocked by a hook',
  'tool-misuse': 'Tool misuse',
  'command-failed': 'Command failed',
  other: 'Other',
};

export const TRIGGER_LABELS: Record<CompactionTrigger, string> = {
  auto: 'Auto',
  manual: 'Manual',
  other: 'Other',
};

function plural(count: number, one: string, other: string): string {
  return `${formatCount(count)} ${count === 1 ? one : other}`;
}

export function frictionCount(count: number): string {
  return plural(count, 'friction', 'frictions');
}

export function perHundred(frictions: number, apiCalls: number): number | null {
  if (apiCalls === 0) return null;
  return Math.round((frictions / apiCalls) * 1000) / 10;
}

export function rateText(rate: number | null): string {
  return rate === null ? MISSING : rate.toFixed(1);
}

export function frictionSummary({
  frictions,
  apiCalls,
}: Pick<FrictionStats, 'frictions' | 'apiCalls'>): string {
  if (frictions === 0) {
    return `No friction · ${plural(apiCalls, 'API call', 'API calls')}`;
  }
  return `${frictionCount(frictions)} · ${rateText(perHundred(frictions, apiCalls))} per 100 API calls`;
}

export function kindOptions(counts: KindCounts): FilterOption<KindChoice>[] {
  const all = FRICTION_KINDS.reduce((sum, kind) => sum + counts[kind], 0);
  return [
    { value: ALL_KINDS, label: 'All', count: all },
    ...FRICTION_KINDS.map((kind) => ({
      value: kind,
      label: KIND_LABELS[kind],
      count: counts[kind],
    })),
  ];
}

export function weekBuckets(weeks: readonly FrictionWeek[]): TrendBucket[] {
  return weeks.map((week, index) => {
    const value = perHundred(week.frictions, week.apiCalls);
    return {
      label:
        index === weeks.length - 1 ? 'this week' : formatBucket(week.start),
      value,
      n: week.apiCalls,
      text: `${rateText(value)} · ${frictionCount(week.frictions)}`,
    };
  });
}

export function shareText(part: number, total: number): string {
  if (total === 0 || part === 0) return '0%';
  const percent = Math.round((part / total) * 100);
  return percent === 0 ? '<1%' : `${String(percent)}%`;
}

export function exitCodesText(codes: readonly number[]): string {
  if (codes.length === 0) return MISSING;
  const shown = codes.slice(0, MAX_EXIT_CODES).map(String).join(', ');
  return codes.length > MAX_EXIT_CODES ? `${shown}, …` : shown;
}

export function compactTokens(value: number | null): string {
  if (value === null) return MISSING;
  return formatTokens(value).replace(/\.0(?=[KMBT]$)/, '');
}

export function programText(program: string | null): string {
  return program === null || program === '' ? MISSING : program;
}

export const hookText = programText;

export function shortSessionTitle(title: string, id: string): string {
  return title === '' ? id.slice(0, 8) : title;
}

export function showsKind(
  kind: FrictionKind | undefined,
  wanted: FrictionKind,
): boolean {
  return kind === undefined || kind === wanted;
}

export const THREAD_NOUN = { one: 'thread', other: 'threads' };

export function perThreadText(value: number): string {
  return value.toFixed(1);
}

export function mainKindText(kind: FrictionKind | null): string {
  return kind === null ? MISSING : KIND_LABELS[kind];
}

export function compactedText(compacted: number, threads: number): string {
  return `${formatCount(compacted)} of ${plural(threads, 'thread', 'threads')} compacted`;
}

export function issueText(
  number: number,
  issue: Parameters<typeof issueTitleText>[0],
): string {
  const title = issueTitleText(issue);
  return title === null ? `#${String(number)}` : `#${String(number)} ${title}`;
}

export function peakLabel(thread: ThreadPeak): string {
  const description = thread.description?.trim() ?? '';
  if (description !== '') return description;
  return sessionTitle({
    title: thread.sessionTitle,
    id: thread.sessionId,
    agent: thread.sessionAgent,
  });
}

export function chipText(
  filters: Pick<FrictionFilters, 'session' | 'issue'>,
  subject: FrictionSubject | null | undefined,
): string | null {
  if (filters.session !== undefined) {
    const known =
      subject?.kind === 'session' &&
      subject.id === filters.session &&
      subject.title !== null
        ? subject
        : undefined;
    return `Session: ${
      known === undefined
        ? filters.session
        : sessionTitle({
            title: known.title ?? '',
            id: known.id,
            agent: known.agent,
          })
    }`;
  }
  if (filters.issue !== undefined) {
    const issue =
      subject?.kind === 'issue' && subject.number === filters.issue
        ? subject.issue
        : { status: 'not-collected' as const };
    return `Issue: ${issueText(filters.issue, issue)}`;
  }
  return null;
}
