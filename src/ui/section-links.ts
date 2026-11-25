import { matchPath } from 'react-router';
import type { ReadyCounts } from '../sidebar/types.ts';
import type { IconName } from './components/Icon.tsx';
import type { SidebarBadge, SidebarLink } from './components/Sidebar.tsx';
import { withProject } from './project-param.ts';

const BUGS_PATH = '/bugs';
const FEATURES_PATH = '/features';

const SECTIONS: readonly { path: string; label: string; icon: IconName }[] = [
  { path: '/', label: 'Overview', icon: 'overview' },
  { path: FEATURES_PATH, label: 'Features', icon: 'features' },
  { path: BUGS_PATH, label: 'Bugs', icon: 'bugs' },
  { path: '/stats', label: 'Stats', icon: 'stats' },
  { path: '/frictions', label: 'Frictions', icon: 'frictions' },
  { path: '/sessions', label: 'Sessions', icon: 'sessions' },
  { path: '/skills', label: 'Skills', icon: 'skills' },
  { path: '/roles', label: 'Roles', icon: 'roles' },
];

export function hasBugTickets(
  bugTickets: readonly string[],
  project: string | undefined,
): boolean {
  return project === undefined
    ? bugTickets.length > 0
    : bugTickets.includes(project);
}

function readyBadge(
  path: string,
  ready: ReadyCounts | undefined,
): SidebarBadge | undefined {
  if (ready === undefined) return undefined;
  if (path === FEATURES_PATH) return { count: ready.feature, tone: 'neutral' };
  if (path === BUGS_PATH) return { count: ready.bug, tone: 'danger' };
  return undefined;
}

export function sectionLinks(
  pathname: string,
  project: string | undefined,
  bugs: boolean,
  ready?: ReadyCounts,
): SidebarLink[] {
  return SECTIONS.filter(({ path }) => bugs || path !== BUGS_PATH).map(
    ({ path, label, icon }) => ({
      label,
      icon,
      href: withProject(path, project),
      current: matchPath({ path, end: path === '/' }, pathname) !== null,
      badge: readyBadge(path, ready),
    }),
  );
}
