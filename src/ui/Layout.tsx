import { type ReactElement, useEffect, useState } from 'react';
import {
  Link,
  Outlet,
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
import {
  RefreshControl,
  collectionText,
} from './components/RefreshControl.tsx';
import {
  Sidebar,
  type SidebarAccount,
  type SidebarProject,
  type SidebarRefresh,
} from './components/Sidebar.tsx';
import { forgetBugTickets, useBugTickets } from './bug-tickets-state.ts';
import type { LoadFactory } from './factory-api.ts';
import { FactoryBanner } from './FactoryBanner.tsx';
import type { LoadCollection, RefreshCollection } from './git-host-api.ts';
import { projectOf, projectTarget } from './project-param.ts';
import type { LayoutOutletContext } from './layout-outlet.ts';
import { hasBugTickets, managerLinks, sectionLinks } from './section-links.ts';
import { projectLabel } from './ProjectSelect.tsx';
import { type LoadSidebar, useReadyCounts } from './sidebar-api.ts';
import { WelcomePanel } from './WelcomePanel.tsx';
import './styles.css';
import './shell.css';

const RETRY_SECONDS = 10;

export interface LayoutProps {
  loadFactory: LoadFactory;
  loadCollection: LoadCollection;
  refreshCollection: RefreshCollection;
  loadSidebar?: LoadSidebar | undefined;
  account?: SidebarAccount | undefined;
  team?: boolean | undefined;
}

function useFactoryStatus(loadFactory: LoadFactory): {
  status: FactoryResponse | undefined;
  forget: (slug: string) => void;
  reload: () => void;
  version: number;
  loads: number;
} {
  const [status, setStatus] = useState<FactoryResponse>();
  const [version, setVersion] = useState(0);
  const [loads, setLoads] = useState(0);

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
  }, [loadFactory, version, loads]);

  function reload(): void {
    setVersion((current) => current + 1);
  }

  function forget(slug: string): void {
    forgetBugTickets(slug);
    setStatus((current) =>
      current?.status === 'ok'
        ? {
            ...current,
            projects: current.projects.filter((row) => row.project !== slug),
            bugTickets: current.bugTickets.filter((row) => row !== slug),
          }
        : current,
    );
    setLoads((current) => current + 1);
  }

  return { status, forget, reload, version, loads };
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

function useProjectChoice(forget: (slug: string) => void): {
  project: string | undefined;
  choose: (next: string | undefined) => void;
  outlet: LayoutOutletContext;
} {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const project = projectOf(searchParams);
  return {
    project,
    choose: (next) => void navigate(projectTarget(location, next)),
    outlet: {
      projectRemoved: (slug) => {
        if (project === slug) {
          void navigate(projectTarget(location, undefined), { replace: true });
        }
        forget(slug);
      },
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
  loadCollection,
  refreshCollection,
  loadSidebar,
  account,
  team = false,
}: LayoutProps): ReactElement {
  const { status, forget, reload, version, loads } =
    useFactoryStatus(loadFactory);
  const { project, choose, outlet } = useProjectChoice(forget);
  const collection = useCollection(loadCollection, refreshCollection, reload);
  const ready = useReadyCounts(
    loadSidebar,
    project,
    status?.refreshSeconds ?? RETRY_SECONDS,
    version + loads,
  );
  const bugTickets = useBugTickets(status);
  const { collectedAt, missing, failures, projects, welcome } = viewOf(
    status,
    collection.status,
  );
  const { pathname } = useLocation();
  return (
    <div className="fd-shell">
      <Sidebar
        links={[
          ...sectionLinks(
            pathname,
            project,
            hasBugTickets(bugTickets, project),
            ready,
          ),
          ...managerLinks(team, pathname, project),
        ]}
        renderLink={renderRouterLink}
        project={welcome ? undefined : projectSlot(project, projects, choose)}
        refresh={refreshSlot(collectedAt, collection)}
        account={account}
      />
      <div className="fd-shell-content">
        {missing.length + failures.length > 0 && (
          <FactoryBanner missing={missing} failures={failures} />
        )}
        <main
          className={`fd-column fd-main${welcome ? ' fd-main-welcome' : ''}`}
        >
          {welcome ? (
            <WelcomePanel />
          ) : (
            <Outlet key={version} context={outlet} />
          )}
        </main>
      </div>
    </div>
  );
}
