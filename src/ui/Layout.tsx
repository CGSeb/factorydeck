import { type ReactElement, useEffect, useState } from 'react';
import {
  NavLink,
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
import { CollectionStatus } from './CollectionStatus.tsx';
import type { DeleteProject, LoadFactory } from './factory-api.ts';
import { FactoryBanner } from './FactoryBanner.tsx';
import type { LoadCollection, RefreshCollection } from './git-host-api.ts';
import { projectOf, projectTarget, withProject } from './project-param.ts';
import { ProjectSelect } from './ProjectSelect.tsx';
import { WelcomePanel } from './WelcomePanel.tsx';
import './styles.css';

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

const SECTIONS: readonly { path: string; label: string }[] = [
  { path: '/', label: 'Overview' },
  { path: '/features', label: 'Features' },
  { path: '/sessions', label: 'Sessions' },
  { path: '/skills', label: 'Skills' },
  { path: '/roles', label: 'Roles' },
];

function SectionNav({
  project,
}: {
  project: string | undefined;
}): ReactElement {
  return (
    <nav aria-label="Sections">
      <ul>
        {SECTIONS.map(({ path, label }) => (
          <li key={path}>
            <NavLink to={withProject(path, project)} end={path === '/'}>
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

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

export function Layout({
  loadFactory,
  deleteProject,
  loadCollection,
  refreshCollection,
}: LayoutProps): ReactElement {
  const { status, forget, reload, version } = useFactoryStatus(loadFactory);
  const { project, choose, onDeleted } = useProjectChoice(forget);
  const collection = useCollection(loadCollection, refreshCollection, reload);
  const { collectedAt, missing, failures, projects, welcome } = viewOf(
    status,
    collection.status,
  );
  return (
    <>
      <header className="topbar">
        <span className="brand">FactoryDeck</span>
        <SectionNav project={project} />
        {!welcome && (
          <ProjectSelect
            value={project}
            projects={projects}
            onChange={choose}
          />
        )}
        <CollectionStatus
          collectedAt={collectedAt}
          now={new Date()}
          refreshing={collection.refreshing}
          onRefresh={collection.refresh}
        />
      </header>
      <main>
        {missing.length + failures.length > 0 && (
          <FactoryBanner
            missing={missing}
            failures={failures}
            deleteProject={deleteProject}
            onDeleted={onDeleted}
          />
        )}
        {welcome ? <WelcomePanel /> : <Outlet key={version} />}
      </main>
    </>
  );
}
