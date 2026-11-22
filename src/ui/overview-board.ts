import type { IssueStage } from '../git-host/types.ts';
import type { FeatureList, FeatureRow } from '../features/types.ts';
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
import { STAGE_PARAM, groupOf, sortRows, stageItems } from './features-list.ts';
import { formatCount, formatTokens } from './format.ts';
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
): BoardColumn[] {
  const showProject = filters.project === undefined;
  const colors = projectColors(list.projects.map(({ project }) => project));
  const items = stageItems(list.rows);
  return STAGE_GROUPS.map((group, index): BoardColumn => {
    const members = sortRows(
      list.rows.filter((row) => groupOf(row) === group),
      'last',
    );
    const shown = members.slice(0, BOARD_CARD_LIMIT);
    const item = items[index];
    return {
      group,
      count: members.length,
      counts: item?.counts ?? {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
      },
      costUsd: item?.costUsd ?? null,
      unknownPriceCalls: item?.unknownPriceCalls ?? 0,
      cards: shown.map((row) => cardOf(row, filters, showProject, colors)),
      more: {
        count: members.length - shown.length,
        href: stagePath(group, filters),
      },
    };
  });
}

function stagePath(group: StageGroup, filters: SkillFilters): string {
  const params = new URLSearchParams({ [STAGE_PARAM]: group });
  return `${listPath('/features', filters)}&${params.toString()}`;
}

function cardOf(
  row: FeatureRow,
  filters: SkillFilters,
  showProject: boolean,
  colors: Map<string, string>,
): StageColumnCard {
  const badge = cardBadge(row);
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
    counts: row.tokenCounts,
    costUsd: row.costUsd,
    unknownPriceCalls: row.costUsd === null ? row.apiCalls : 0,
    showProject,
  };
}

export function headlineCount(merged: number): string {
  if (merged === 0) return 'No issue merged · ';
  return `${formatCount(merged)} ${merged === 1 ? 'issue' : 'issues'} merged for `;
}

export function headlineSummary(
  merged: FeatureList['merged'],
  sessions: number,
): string {
  const sessionText = `${formatCount(sessions)} ${sessions === 1 ? 'session' : 'sessions'}`;
  if (merged.issues === 0) return sessionText;
  const withoutPerson = Math.round((merged.withoutPerson ?? 0) * merged.issues);
  return [
    `${formatTokens(merged.tokensPerIssue ?? 0)} tokens per merged issue`,
    `${formatCount(withoutPerson)} of ${formatCount(merged.issues)} merged without a person`,
    sessionText,
  ].join(' · ');
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
