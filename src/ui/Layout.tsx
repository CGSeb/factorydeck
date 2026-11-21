import { type ReactElement, useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import type { FactoryResponse } from '../projects/types.ts';
import type { DeleteProject, LoadFactory } from './factory-api.ts';
import { FactoryBanner } from './FactoryBanner.tsx';
import { WelcomePanel } from './WelcomePanel.tsx';
import './styles.css';

const RETRY_SECONDS = 10;

export interface LayoutProps {
  loadFactory: LoadFactory;
  deleteProject: DeleteProject;
}

function useFactoryStatus(loadFactory: LoadFactory): {
  status: FactoryResponse | undefined;
  forget: (project: string) => void;
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

  return { status, forget, version };
}

export function Layout({
  loadFactory,
  deleteProject,
}: LayoutProps): ReactElement {
  const { status, forget, version } = useFactoryStatus(loadFactory);
  const factory = status?.status === 'ok' ? status : undefined;
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
      </header>
      <main>
        {factory !== undefined && factory.missing.length > 0 && (
          <FactoryBanner
            missing={factory.missing}
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
