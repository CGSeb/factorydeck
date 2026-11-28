import { byProjectOrder } from '../team/project-order.ts';
import { formatCount, formatDay } from './format.ts';
import type { ListedProject, TeamProject } from './projects-api.ts';

export const PROJECTS_REFUSED = 'Only managers can manage projects.';
export const NO_PROJECT =
  'No project yet. Add the first one with its git remote.';

export function projectsSummary(projects: readonly TeamProject[]): string {
  const count = projects.length;
  return `${formatCount(count)} project${count === 1 ? '' : 's'}`;
}

export function projectSettingsPath(slug: string): string {
  return `/projects/${encodeURIComponent(slug)}`;
}

export function projectSummary({ remote, sessions }: ListedProject): string {
  return `${remote} · ${formatCount(sessions)} session${sessions === 1 ? '' : 's'}`;
}

export function noProject(slug: string): string {
  return `No project ${slug}.`;
}

export function noLongerThere(name: string): string {
  return `${name} is no longer in FactoryDeck.`;
}

export function formatAddedDate(at: string): string {
  return `${formatDay(at)} ${String(new Date(at).getFullYear())}`;
}

export function withAdded(
  projects: readonly TeamProject[],
  added: readonly TeamProject[],
): TeamProject[] {
  const ids = new Set(projects.map(({ id }) => id));
  return [...projects, ...added.filter(({ id }) => !ids.has(id))].sort(
    byProjectOrder,
  );
}
