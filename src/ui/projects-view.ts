import { byProjectOrder } from '../team/project-order.ts';
import { formatCount, formatDay } from './format.ts';
import type {
  ListedProject,
  PendingRemote,
  TeamProject,
} from './projects-api.ts';

export const PROJECTS_REFUSED = 'Only managers can manage projects.';
export const NO_PROJECT =
  'No project yet. Add the first one with its git remote.';

export const REMOTES_NOT_ADDED = 'Remotes not added yet';
export const NO_REMOTE = 'No remote';

export function counted(count: number, noun: string): string {
  return `${formatCount(count)} ${noun}${count === 1 ? '' : 's'}`;
}

export function projectsSummary(
  projects: readonly TeamProject[],
  remotesNotAdded = 0,
): string {
  const summary = counted(projects.length, 'project');
  if (remotesNotAdded === 0) return summary;
  return `${summary} · ${counted(remotesNotAdded, 'remote')} not added`;
}

export function addRemoteValue(remote: string): string {
  return `https://${remote}`;
}

export function withoutProjects(
  pending: readonly PendingRemote[],
  projects: readonly TeamProject[],
): PendingRemote[] {
  const added = new Set(projects.map(({ remote }) => remote));
  return pending.filter(({ remote }) => !added.has(remote));
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

export function withAdded<T extends TeamProject>(
  projects: readonly T[],
  added: readonly T[],
): T[] {
  const ids = new Set(projects.map(({ id }) => id));
  return [...projects, ...added.filter(({ id }) => !ids.has(id))].sort(
    byProjectOrder,
  );
}
