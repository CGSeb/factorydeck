import type { FeatureRow } from '../features/types.ts';
import type { IssueStage } from '../git-host/types.ts';
import { roleColors } from './design/palette.ts';
import type { SortOption } from './components/SortSelect.tsx';
import { STAGE_GROUPS, type StageGroup } from './components/StageDot.tsx';
import type { StageStripItem } from './components/StageStrip.tsx';
import { formatTokens } from './format.ts';

export const STAGE_PARAM = 'stage';
export const SORT_PARAM = 'sort';

export const FEATURE_SORT_KEYS = [
  'last',
  'tokens',
  'sessions',
  'rounds',
  'score',
  'number',
] as const;

export type FeatureSortKey = (typeof FEATURE_SORT_KEYS)[number];

export const DEFAULT_FEATURE_SORT: FeatureSortKey = 'last';

export const FEATURE_SORT_OPTIONS: SortOption<FeatureSortKey>[] = [
  { value: 'last', label: 'Last activity' },
  { value: 'tokens', label: 'Tokens' },
  { value: 'sessions', label: 'Sessions' },
  { value: 'rounds', label: 'Review rounds' },
  { value: 'score', label: 'Serenity' },
  { value: 'number', label: 'Issue number' },
];

export type ListGroup = StageGroup | 'closed' | 'unknown';

export const LIST_GROUPS: readonly ListGroup[] = [
  'in-review',
  'working',
  'ready',
  'merged',
  'closed',
  'unknown',
];

export const LIST_GROUP_LABELS: Record<ListGroup, string> = {
  'in-review': 'In review',
  working: 'Working',
  ready: 'Ready',
  merged: 'Merged',
  closed: 'Closed',
  unknown: 'Unknown',
};

const STAGE_TO_GROUP: Record<IssueStage, ListGroup> = {
  open: 'ready',
  'needs-spec': 'ready',
  ready: 'ready',
  blocked: 'ready',
  working: 'working',
  'in-review': 'in-review',
  merged: 'merged',
  'merged-by-person': 'merged',
  closed: 'closed',
};

export interface RowGroup {
  group: ListGroup;
  rows: FeatureRow[];
}

function isStageGroup(value: string | null): value is StageGroup {
  return STAGE_GROUPS.some((group) => group === value);
}

function isSortKey(value: string | null): value is FeatureSortKey {
  return FEATURE_SORT_KEYS.some((key) => key === value);
}

export function stageOf(params: URLSearchParams): StageGroup | null {
  const value = params.get(STAGE_PARAM);
  return isStageGroup(value) ? value : null;
}

export function featureSortOf(params: URLSearchParams): FeatureSortKey {
  const value = params.get(SORT_PARAM);
  return isSortKey(value) ? value : DEFAULT_FEATURE_SORT;
}

export function withListParams(
  current: URLSearchParams,
  { sort, stage }: { sort: FeatureSortKey; stage: StageGroup | null },
): URLSearchParams {
  const next = new URLSearchParams(current);
  next.delete('order');
  if (sort === DEFAULT_FEATURE_SORT) next.delete(SORT_PARAM);
  else next.set(SORT_PARAM, sort);
  if (stage === null) next.delete(STAGE_PARAM);
  else next.set(STAGE_PARAM, stage);
  return next;
}

export function groupOf(row: FeatureRow): ListGroup {
  return row.outcome === null ? 'unknown' : STAGE_TO_GROUP[row.outcome.stage];
}

function timeOf(at: string | null): number | null {
  if (at === null) return null;
  const time = Date.parse(at);
  return Number.isNaN(time) ? null : time;
}

const SORT_VALUES: Record<FeatureSortKey, (row: FeatureRow) => number | null> =
  {
    last: (row) => timeOf(row.lastAt),
    tokens: (row) => row.tokens,
    sessions: (row) => row.sessions,
    rounds: (row) => row.outcome?.report?.rounds ?? null,
    score: (row) => row.outcome?.report?.score ?? null,
    number: (row) => row.number,
  };

function descending(a: number | null, b: number | null): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  return b - a;
}

function ascending(a: number | null, b: number | null): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  return a - b;
}

export function sortRows(
  rows: readonly FeatureRow[],
  key: FeatureSortKey,
): FeatureRow[] {
  const value = SORT_VALUES[key];
  const compare = key === 'score' ? ascending : descending;
  return [...rows].sort(
    (left, right) =>
      compare(value(left), value(right)) ||
      descending(timeOf(left.lastAt), timeOf(right.lastAt)) ||
      right.number - left.number ||
      left.project.localeCompare(right.project),
  );
}

export function groupRows(
  rows: readonly FeatureRow[],
  sort: FeatureSortKey,
  stage: StageGroup | null,
): RowGroup[] {
  return LIST_GROUPS.filter((group) => stage === null || group === stage)
    .map((group) => ({
      group,
      rows: sortRows(
        rows.filter((row) => groupOf(row) === group),
        sort,
      ),
    }))
    .filter(({ rows: grouped }) => grouped.length > 0);
}

export function stageItems(rows: readonly FeatureRow[]): StageStripItem[] {
  return STAGE_GROUPS.map((group) => {
    const members = rows.filter((row) => groupOf(row) === group);
    const priced = members.filter((row) => row.costUsd !== null);
    return {
      group,
      count: members.length,
      counts: {
        input: members.reduce((sum, row) => sum + row.tokenCounts.input, 0),
        output: members.reduce((sum, row) => sum + row.tokenCounts.output, 0),
        cacheRead: members.reduce(
          (sum, row) => sum + row.tokenCounts.cacheRead,
          0,
        ),
        cacheWrite: members.reduce(
          (sum, row) => sum + row.tokenCounts.cacheWrite,
          0,
        ),
      },
      costUsd:
        members.length > 0 && priced.length === 0
          ? null
          : priced.reduce((sum, row) => sum + (row.costUsd ?? 0), 0),
      unknownPriceCalls: members
        .filter((row) => row.costUsd === null)
        .reduce((sum, row) => sum + row.apiCalls, 0),
    };
  });
}

export function rowRoleColors(
  rows: readonly FeatureRow[],
): Map<string, string> {
  const tokens = new Map<string, number>();
  for (const row of rows) {
    for (const share of row.roles) {
      tokens.set(share.role, (tokens.get(share.role) ?? 0) + share.tokens);
    }
  }
  const ordered = [...tokens.entries()]
    .sort(
      ([leftRole, left], [rightRole, right]) =>
        right - left || leftRole.localeCompare(rightRole),
    )
    .map(([role]) => role);
  return roleColors(ordered);
}

export function summaryText(
  issues: number,
  merged: {
    issues: number;
    withoutPerson: number | null;
    tokensPerIssue: number | null;
  },
): string {
  const count = `${String(issues)} ${issues === 1 ? 'issue' : 'issues'}`;
  if (merged.issues === 0) return count;
  const withoutPerson = Math.round((merged.withoutPerson ?? 0) * merged.issues);
  return `${count} · ${String(merged.issues)} merged, ${String(withoutPerson)} without a person · ${formatTokens(merged.tokensPerIssue ?? 0)} tokens per merged issue`;
}
