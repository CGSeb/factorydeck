import { useState } from 'react';
import type {
  LoadProjects,
  RemoveProject,
  TeamProject,
} from './projects-api.ts';
import type { GitHostKind } from './git-host-token-api.ts';
import type { RemoveDialogState } from './RemoveProjectDialog.tsx';

export type ProjectRow = TeamProject & {
  sessions?: number;
  gitHost?: GitHostKind | null;
  tokenSet?: boolean;
};

export interface Removal {
  project: TeamProject;
  sessions: number | undefined;
  state: RemoveDialogState;
}

async function countSessions(
  loadProjects: LoadProjects,
  id: number,
): Promise<number | undefined> {
  const view = await loadProjects();
  if (view?.status !== 'ok') return undefined;
  return view.projects.find((project) => project.id === id)?.sessions;
}

export function useRemoval(
  loadProjects: LoadProjects,
  removeProject: RemoveProject | undefined,
  onRemoved: (project: TeamProject) => void,
): {
  removal: Removal | undefined;
  open: ((project: ProjectRow) => void) | undefined;
  close: () => void;
  confirm: (removal: Removal) => Promise<void>;
} {
  const [removal, setRemoval] = useState<Removal>();
  function update(
    id: number,
    change: (current: Removal) => Removal | undefined,
  ): void {
    setRemoval((current) =>
      current?.project.id === id ? change(current) : current,
    );
  }
  function open(project: ProjectRow): void {
    setRemoval({ project, sessions: project.sessions, state: 'idle' });
    void countSessions(loadProjects, project.id).then((sessions) => {
      if (sessions !== undefined) {
        update(project.id, (current) => ({ ...current, sessions }));
      }
    });
  }
  async function confirm(current: Removal): Promise<void> {
    if (removeProject === undefined) return;
    const { project } = current;
    setRemoval({ ...current, state: 'removing' });
    const outcome = await removeProject(project);
    if (outcome === 'removed') {
      update(project.id, () => undefined);
      onRemoved(project);
      return;
    }
    update(project.id, (latest) => ({ ...latest, state: outcome }));
  }
  return {
    removal,
    open: removeProject === undefined ? undefined : open,
    close: () => {
      setRemoval(undefined);
    },
    confirm,
  };
}
