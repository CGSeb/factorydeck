import { type ReactElement, useEffect, useState } from 'react';
import {
  Link,
  Outlet,
  matchPath,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router';
import type {
  CollectionFailure,
  CollectionResponse,
} from '../git-host/types.ts';
import type { ProjectOption } from '../projects/label.ts';
import type { FactoryResponse, MissingFactory } from '../projects/types.ts';
import type { RenderLink } from './components/link.ts';
import { ProjectPill } from './components/ProjectPill.tsx';
import type { IconName } from './components/Icon.tsx';
import {
  RefreshControl,
  collectionText,
} from './components/RefreshControl.tsx';
import {
  Sidebar,
  type SidebarLink,
  type SidebarProject,
  type SidebarRefresh,
} from './components/Sidebar.tsx';
import { useBugTickets } from './bug-tickets-state.ts';
import type { DeleteProject, LoadFactory } from './factory-api.ts';
import { FactoryBanner } from './FactoryBanner.tsx';
import type { LoadCollection, RefreshCollection } from './git-host-api.ts';
import { projectOf, projectTarget, withProject } from './project-param.ts';
import { projectLabel } from './ProjectSelect.tsx';
import { WelcomePanel } from './WelcomePanel.tsx';
import './styles.css';
import './shell.css';

const RETRY_SECONDS = 10;

export interface LayoutProps {
  loadFactory: LoadFactory;
  deleteProject: DeleteProject;
  loadCollection: LoadCollection;
  refreshCollection: RefreshCollection;
}

function useFactoryStatus(loadFactory: LoadFactory): {
  status: FactoryResponse | undefined;
  forget: (project: string) => void;
  reload: () => void;
  version: number;
} {
  const [status, setStatus] = useState<FactoryResponse>();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function refresh(): Promise<void> {
      const next = await loadFactory();
      if (!active) return;
      if (next !== undefined) setStatus(next);
      timer = setTimeout(
        () => void refresh(),
        (next?.refreshSeconds ?? RETRY_SECONDS) * 1000,
      );
    }
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [loadFactory, version]);

  function reload(): void {
    setVersion((current) => current + 1);
  }

  function forget(project: string): void {
    setStatus((current) =>
      current?.status === 'ok'
        ? {
            ...current,
            missing: current.missing.filter((row) => row.project !== project),
            projects: current.projects.filter((row) => row.project !== project),
          }
        : current,
    );
    setVersion((current) => current + 1);
  }

  return { status, forget, reload, version };
}

function useCollection(
  loadCollection: LoadCollection,
  refreshCollection: RefreshCollection,
  onRefreshed: () => void,
): {
  status: CollectionResponse | undefined;
  refreshing: boolean;
  refresh: () => void;
} {
  const [status, setStatus] = useState<CollectionResponse>();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll(): Promise<void> {
      const next = await loadCollection();
      if (!active) return;
      if (next !== undefined) setStatus(next);
      timer = setTimeout(
        () => void poll(),
        (next?.refreshSeconds ?? RETRY_SECONDS) * 1000,
      );
    }
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [loadCollection]);

  async function run(): Promise<void> {
    setRefreshing(true);
    const next = await refreshCollection();
    if (next !== undefined) setStatus(next);
    setRefreshing(false);
    onRefreshed();
  }

  return { status, refreshing, refresh: () => void run() };
}

function okOrUndefined(
  response: CollectionResponse | undefined,
): Extract<CollectionResponse, { status: 'ok' }> | undefined {
  return response?.status === 'ok' ? response : undefined;
}

const BUGS_PATH = '/bugs';

const SECTIONS: readonly { path: string; label: string; icon: IconName }[] = [
  { path: '/', label: 'Overview', icon: 'overview' },
  { path: '/features', label: 'Features', icon: 'features' },
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

function sectionLinks(
  pathname: string,
  project: string | undefined,
  bugs: boolean,
): SidebarLink[] {
  return SECTIONS.filter(({ path }) => bugs || path !== BUGS_PATH).map(
    ({ path, label, icon }) => ({
      label,
      icon,
      href: withProject(path, project),
      current: matchPath({ path, end: path === '/' }, pathname) !== null,
    }),
  );
}

export const renderRouterLink: RenderLink = ({ href, ...props }) => (
  <Link to={href} {...props} />
);

function viewOf(
  status: FactoryResponse | undefined,
  collection: CollectionResponse | undefined,
): {
  collectedAt: string | null | undefined;
  missing: MissingFactory[];
  failures: CollectionFailure[];
  projects: ProjectOption[];
  welcome: boolean;
} {
  const factory = status?.status === 'ok' ? status : undefined;
  const collected = okOrUndefined(collection);
  return {
    collectedAt: collected?.collectedAt,
    missing: factory?.missing ?? [],
    failures: collected?.failures ?? [],
    projects: factory?.projects ?? [],
    welcome: factory?.hasSessions === false,
  };
}

function useProjectChoice(forget: (project: string) => void): {
  project: string | undefined;
  choose: (next: string | undefined) => void;
  onDeleted: (deleted: string) => void;
} {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const project = projectOf(searchParams);
  return {
    project,
    choose: (next) => void navigate(projectTarget(location, next)),
    onDeleted: (deleted) => {
      forget(deleted);
      if (deleted === project) {
        void navigate(projectTarget(location, undefined), { replace: true });
      }
    },
  };
}

function projectSlot(
  project: string | undefined,
  projects: ProjectOption[],
  choose: (next: string | undefined) => void,
): SidebarProject {
  return {
    label: projectLabel(project, projects),
    render: (control) => (
      <ProjectPill
        value={project}
        projects={projects}
        onChange={choose}
        {...control}
      />
    ),
  };
}

function refreshSlot(
  collectedAt: string | null | undefined,
  collection: { refreshing: boolean; refresh: () => void },
): SidebarRefresh {
  const now = new Date();
  return {
    tip: collectionText(collectedAt, now) ?? 'Refresh',
    render: (compact) => (
      <RefreshControl
        collectedAt={collectedAt}
        now={now}
        refreshing={collection.refreshing}
        onRefresh={collection.refresh}
        compact={compact}
      />
    ),
  };
}

export function Layout({
  loadFactory,
  deleteProject,
  loadCollection,
  refreshCollection,
}: LayoutProps): ReactElement {
  const { status, forget, reload, version } = useFactoryStatus(loadFactory);
  const { project, choose, onDeleted } = useProjectChoice(forget);
  const collection = useCollection(loadCollection, refreshCollection, reload);
  const bugTickets = useBugTickets(status);
  const { collectedAt, missing, failures, projects, welcome } = viewOf(
    status,
    collection.status,
  );
  const { pathname } = useLocation();
  return (
    <div className="fd-shell">
      <Sidebar
        links={sectionLinks(
          pathname,
          project,
          hasBugTickets(bugTickets, project),
        )}
        renderLink={renderRouterLink}
        project={welcome ? undefined : projectSlot(project, projects, choose)}
        refresh={refreshSlot(collectedAt, collection)}
      />
      <div className="fd-shell-content">
        {missing.length + failures.length > 0 && (
          <FactoryBanner
            missing={missing}
            failures={failures}
            deleteProject={deleteProject}
            onDeleted={onDeleted}
          />
        )}
        <main
          className={`fd-column fd-main${welcome ? ' fd-main-welcome' : ''}`}
        >
          {welcome ? <WelcomePanel /> : <Outlet key={version} />}
        </main>
      </div>
    </div>
  );
}
