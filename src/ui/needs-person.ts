import type { WaitReason, WaitingList } from '../stats/types.ts';
import { projectColors } from './design/palette.ts';
import { featurePath } from './features-api.ts';
import { MISSING, formatElapsed } from './format.ts';
import type { SkillFilters } from './skills-api.ts';

export const NEEDS_PERSON_ROWS = 10;

export const WAIT_REASON_LABELS: Record<WaitReason, string> = {
  blocked: 'Blocked',
  'spec-question': 'Spec question',
  'below-threshold': 'Below threshold',
  'gates-failed': 'Gates failed',
};

export interface NeedsPersonRow {
  project: string;
  projectName: string;
  projectColor: string;
  number: number;
  label: string;
  href: string;
  reasons: string[];
  since: string | null;
  wait: string;
}

export function reasonLabel(
  reason: WaitReason,
  score: number | undefined,
): string {
  const label = WAIT_REASON_LABELS[reason];
  return reason === 'below-threshold' && score !== undefined
    ? `${label} (${String(score)})`
    : label;
}

export function waitText(since: string | null, now: Date): string {
  return since === null
    ? MISSING
    : formatElapsed(now.getTime() - new Date(since).getTime());
}

export function needsPersonRows(
  list: WaitingList,
  filters: Pick<SkillFilters, 'period'>,
  now: Date,
): NeedsPersonRow[] {
  const colors = projectColors(list.projects.map(({ project }) => project));
  return list.issues.map((issue) => ({
    project: issue.project,
    projectName: issue.projectName,
    projectColor: colors.get(issue.project) ?? 'var(--fd-muted)',
    number: issue.number,
    label:
      issue.title.trim() === ''
        ? `#${String(issue.number)}`
        : `#${String(issue.number)} ${issue.title}`,
    href: featurePath(issue, filters),
    reasons: issue.reasons.map((reason) => reasonLabel(reason, issue.score)),
    since: issue.since,
    wait: waitText(issue.since, now),
  }));
}
