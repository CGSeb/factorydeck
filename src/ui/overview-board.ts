import type { IssueStage } from '../git-host/types.ts';
import type { FeatureList, FeatureRow } from '../features/types.ts';
import type { IssueKind } from '../git-host/kind.ts';
import type { SeriesPoint } from '../overview/types.ts';
import type { RoleList } from '../roles/types.ts';
import type { ChartSegment } from './components/chart-math.ts';
import type { DayBucket } from './components/DayBars.tsx';
import type { IssueCardBadge } from './components/IssueCard.tsx';
import type {
  StageColumnCard,
  StageColumnProps,
} from './components/StageColumn.tsx';
import { serenityScore } from './components/SerenityBadge.tsx';
import { STAGE_GROUPS, type StageGroup } from './components/StageDot.tsx';
import { totalTokens } from './components/token-amount.ts';
import { projectColors } from './design/palette.ts';
import { featurePath } from './features-api.ts';
import { STAGE_PARAM, groupOf, sortRows } from './features-list.ts';
import { formatActivity, formatCount, formatTokens } from './format.ts';
import { KIND_PARAM } from './kind-filter.ts';
import { isEnough } from './components/stats-math.ts';
import type { FlowSample } from './stats-view.ts';
import { byTokensDescending, colorsOfRoles } from './roles-view.ts';
import type { SkillFilters } from './skills-api.ts';

export const BOARD_CARD_LIMIT = 5;

export type BoardColumn = Omit<StageColumnProps, 'renderLink'>;

export function listPath(path: string, filters: SkillFilters): string {
  const params = new URLSearchParams({ period: filters.period });
  if (filters.project !== undefined) params.set('project', filters.project);
  return `${path}?${params.toString()}`;
}

const PERSON_BADGES: Partial<Record<IssueStage, string>> = {
  'merged-by-person': 'by a person',
  'merged-after-person': 'after a person',
};

const BADGES: Record<
  StageGroup,
  (row: FeatureRow) => IssueCardBadge | IssueCardBadge[] | undefined
> = {
  ready: (row) => {
    const stage = row.outcome?.stage;
    return stage === undefined || stage === 'ready'
      ? undefined
      : { kind: 'stage', stage };
  },
  working: () => undefined,
  'in-review': (row) => {
    const rounds = row.outcome?.report?.rounds ?? 0;
    return rounds > 0 ? { kind: 'rounds', rounds, inReview: true } : undefined;
  },
  merged: (row) => {
    const report = row.outcome?.report ?? null;
    const badges: IssueCardBadge[] = [];
    if (report !== null) {
      badges.push({
        kind: 'serenity',
        report: serenityScore(report),
      });
    }
    const stage = row.outcome?.stage;
    const person = stage === undefined ? undefined : PERSON_BADGES[stage];
    if (person !== undefined) badges.push({ kind: 'text', text: person });
    return badges.length === 0 ? undefined : badges;
  },
};

export function cardBadge(
  row: FeatureRow,
): IssueCardBadge | IssueCardBadge[] | undefined {
  const group = groupOf(row);
  return group === 'closed' || group === 'unknown'
    ? undefined
    : BADGES[group](row);
}

export function boardColumns(
  list: FeatureList,
  filters: SkillFilters,
  now: Date,
  kind: IssueKind | null = null,
): BoardColumn[] {
  const showProject = filters.project === undefined;
  const colors = projectColors(list.projects.map(({ project }) => project));
  return STAGE_GROUPS.map((group): BoardColumn => {
    const members = sortRows(
      list.rows.filter((row) => groupOf(row) === group),
      'last',
    );
    const shown = members.slice(0, BOARD_CARD_LIMIT);
    return {
      group,
      count: members.length,
      cards: shown.map((row) =>
        cardOf(row, filters, { showProject, colors, now }),
      ),
      more: {
        count: members.length - shown.length,
        href: stagePath(group, filters, kind),
      },
    };
  });
}

export function isBoardEmpty(columns: readonly BoardColumn[]): boolean {
  return columns.every((column) => column.count === 0);
}

function stagePath(
  group: StageGroup,
  filters: SkillFilters,
  kind: IssueKind | null,
): string {
  const params = new URLSearchParams({ [STAGE_PARAM]: group });
  if (kind !== null) params.set(KIND_PARAM, kind);
  return `${listPath('/features', filters)}&${params.toString()}`;
}

function withBugBadge(
  row: FeatureRow,
  badge: IssueCardBadge | IssueCardBadge[] | undefined,
): IssueCardBadge | IssueCardBadge[] | undefined {
  if (row.kind !== 'bug') return badge;
  const others = badge === undefined ? [] : 'kind' in badge ? [badge] : badge;
  return [{ kind: 'bug' }, ...others];
}

interface CardContext {
  showProject: boolean;
  colors: Map<string, string>;
  now: Date;
}

function cardOf(
  row: FeatureRow,
  filters: SkillFilters,
  { showProject, colors, now }: CardContext,
): StageColumnCard {
  const badge = withBugBadge(row, cardBadge(row));
  return {
    issue: {
      project: row.project,
      projectName: row.projectName,
      projectColor: colors.get(row.project) ?? 'var(--fd-muted)',
      number: row.number,
      title:
        row.issue.status === 'found'
          ? { status: 'found', title: row.issue.title }
          : { status: row.issue.status },
      href: featurePath(row, filters),
    },
    ...(badge === undefined ? {} : { badge }),
    ...(row.lastAt === null
      ? {}
      : {
          activity: { at: row.lastAt, text: formatActivity(row.lastAt, now) },
        }),
    showProject,
  };
}

export function headlineCount(merged: number): string {
  if (merged === 0) return 'No issue merged · ';
  return `${formatCount(merged)} ${merged === 1 ? 'issue' : 'issues'} merged for `;
}

function countOf(count: number, one: string, many: string): string {
  return `${formatCount(count)} ${count === 1 ? one : many}`;
}

export function headlineKinds(
  merged: Record<IssueKind, number>,
  bugTickets: boolean,
): string {
  if (!bugTickets) return headlineCount(merged.feature + merged.bug);
  const parts = [
    merged.feature > 0 ? countOf(merged.feature, 'feature', 'features') : '',
    merged.bug > 0 ? countOf(merged.bug, 'bug', 'bugs') : '',
  ].filter((part) => part !== '');
  if (parts.length === 0) return headlineCount(0);
  return `${parts.join(' and ')} merged for `;
}

export function openBugsText(open: number): string {
  return countOf(open, 'open bug', 'open bugs');
}

export function headlineSummary(
  tokensPerIssue: FlowSample | undefined,
  sessions: number,
): string {
  const sessionText = `${formatCount(sessions)} ${sessions === 1 ? 'session' : 'sessions'}`;
  if (
    tokensPerIssue === undefined ||
    tokensPerIssue.value === null ||
    !isEnough(tokensPerIssue.n)
  ) {
    return sessionText;
  }
  return `${formatTokens(tokensPerIssue.value)} tokens per merged issue · ${sessionText}`;
}

export function roleSegments(list: RoleList): ChartSegment[] {
  const roles = byTokensDescending(list.roles, (row) => row.role);
  const colors = colorsOfRoles(list.order, roles);
  return roles.map((row) => ({
    label: row.role,
    value: row.tokens,
    color: colors.get(row.role) ?? 'var(--fd-muted)',
    counts: row.tokenCounts,
    costUsd: row.costUsd,
  }));
}

export function tokenBuckets(series: readonly SeriesPoint[]): DayBucket[] {
  return series.map((point) => ({
    label: point.bucket,
    value: totalTokens(point.tokens),
    counts: point.tokens,
    costUsd: point.opus + point.sonnet + point.haiku + point.other,
  }));
}
