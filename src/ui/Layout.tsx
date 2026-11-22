import { type ReactElement, useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import type { CollectionResponse } from '../git-host/types.ts';
import type { FactoryResponse } from '../projects/types.ts';
import { CollectionStatus } from './CollectionStatus.tsx';
import type { DeleteProject, LoadFactory } from './factory-api.ts';
import { FactoryBanner } from './FactoryBanner.tsx';
import type { LoadCollection, RefreshCollection } from './git-host-api.ts';
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

export function Layout({
  loadFactory,
  deleteProject,
  loadCollection,
  refreshCollection,
}: LayoutProps): ReactElement {
  const { status, forget, reload, version } = useFactoryStatus(loadFactory);
  const collection = useCollection(loadCollection, refreshCollection, reload);
  const factory = status?.status === 'ok' ? status : undefined;
  const collected = okOrUndefined(collection.status);
  const missing = factory?.missing ?? [];
  const failures = collected?.failures ?? [];
  return (
    <>
      <header className="topbar">
        <span className="brand">FactoryDeck</span>
        <nav aria-label="Sections">
          <ul>
            <li>
              <NavLink to="/" end>
                Overview
              </NavLink>
            </li>
            <li>
              <NavLink to="/sessions">Sessions</NavLink>
            </li>
            <li>
              <NavLink to="/skills">Skills</NavLink>
            </li>
            <li>
              <NavLink to="/roles">Roles</NavLink>
            </li>
          </ul>
        </nav>
        <CollectionStatus
          collectedAt={collected?.collectedAt}
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
            onDeleted={forget}
          />
        )}
        {factory?.hasSessions === false ? (
          <WelcomePanel />
        ) : (
          <Outlet key={version} />
        )}
      </main>
    </>
  );
}
