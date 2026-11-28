import { useCallback, useMemo, useState } from 'react';
import type {
  LoadProjects,
  NoRemote,
  PendingRemote,
  ProjectsView,
  TeamProject,
} from './projects-api.ts';
import { withAdded, withoutProjects } from './projects-view.ts';
import type { ProjectRow } from './project-removal.ts';
import { useRefreshing } from './skills-api.ts';

export type ListView =
  | Exclude<ProjectsView, { status: 'ok' }>
  | ({ status: 'ok'; projects: readonly ProjectRow[] } & RemotesNotAddedView);

interface RemotesNotAddedView {
  pendingRemotes: readonly PendingRemote[];
  noRemote: NoRemote | null;
}

export function useProjects(loadProjects: LoadProjects): {
  view: ListView | undefined;
  added: (project: TeamProject) => void;
  removed: (project: TeamProject) => void;
} {
  const [version, setVersion] = useState(0);
  const [local, setLocal] = useState<readonly TeamProject[]>([]);
  const [gone, setGone] = useState<ReadonlySet<number>>(new Set());
  const loaded = useRefreshing(
    `projects:${String(version)}`,
    loadProjects,
    'projects',
  );
  const view = useMemo((): ListView | undefined => {
    if (loaded?.status !== 'ok') return loaded;
    const projects = withAdded<ProjectRow>(loaded.projects, local).filter(
      ({ id }) => !gone.has(id),
    );
    return {
      status: 'ok',
      projects,
      pendingRemotes: withoutProjects(loaded.pendingRemotes, projects),
      noRemote: loaded.noRemote,
    };
  }, [loaded, local, gone]);
  const added = useCallback((project: TeamProject) => {
    setLocal((previous) => [...previous, project]);
    setVersion((previous) => previous + 1);
  }, []);
  const removed = useCallback((project: TeamProject) => {
    setGone((previous) => new Set([...previous, project.id]));
    setVersion((previous) => previous + 1);
  }, []);
  return { view, added, removed };
}
