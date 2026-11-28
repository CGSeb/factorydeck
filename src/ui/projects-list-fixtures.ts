import type {
  AddProject,
  AddProjectOutcome,
  ListedProject,
  LoadProjects,
  NoRemote,
  PendingRemote,
  ProjectsView,
  SaveProject,
  SaveProjectOutcome,
  RemoveProject,
  RemoveProjectOutcome,
  TeamProject,
} from './projects-api.ts';

export const PROJECTS_NOW = new Date('2026-03-12T12:00:00Z');

export const someProjects: ListedProject[] = [
  {
    id: 2,
    name: 'atlas',
    slug: 'atlas',
    remote: 'gitlab.example.test/platform/tools/atlas',
    createdAt: '2026-02-03T09:00:00Z',
    sessions: 1,
  },
  {
    id: 1,
    name: 'Billing',
    slug: 'billing-service',
    remote: 'github.com/example-org/billing-service',
    createdAt: '2026-01-15T14:20:00Z',
    sessions: 1284,
  },
  {
    id: 3,
    name: 'Website',
    slug: 'website',
    remote: 'github.com/example-org/website',
    createdAt: '2026-03-10T08:45:00Z',
    sessions: 0,
  },
];

export const addedProject: TeamProject = {
  id: 4,
  name: 'factorydeck',
  slug: 'factorydeck',
  remote: 'github.com/example-org/factorydeck',
  createdAt: '2026-03-12T10:00:00Z',
};

export const somePendingRemotes: PendingRemote[] = [
  {
    remote: 'github.com/example-org/factorydeck',
    sessions: 12,
    firstAt: '2026-03-02T08:00:00Z',
    lastAt: '2026-03-12T11:40:00Z',
  },
  {
    remote: 'gitlab.example.test/platform/tools/ledger',
    sessions: 1,
    firstAt: '2026-03-09T09:15:00Z',
    lastAt: '2026-03-09T10:30:00Z',
  },
];

export const someNoRemote: NoRemote = { sessions: 4, folders: 2 };

export function projectsResponse(
  projects: ListedProject[],
  pendingRemotes: PendingRemote[] = [],
  noRemote: NoRemote | null = null,
): ProjectsView {
  return {
    status: 'ok',
    refreshSeconds: 3600,
    projects,
    pendingRemotes,
    noRemote,
  };
}

export function projectsLoaderOf(view: ProjectsView | undefined): LoadProjects {
  return () => Promise.resolve(view);
}

export function pendingProjects(): LoadProjects {
  return () => new Promise<undefined>(() => undefined);
}

export function addingAnswer(outcome: AddProjectOutcome): AddProject {
  return () => Promise.resolve(outcome);
}

export function savingAnswer(outcome: SaveProjectOutcome): SaveProject {
  return () => Promise.resolve(outcome);
}

export function pendingSave(): SaveProject {
  return () => new Promise<SaveProjectOutcome>(() => undefined);
}

export function removerOf(outcome: RemoveProjectOutcome): RemoveProject {
  return () => Promise.resolve(outcome);
}

export function pendingRemover(): RemoveProject {
  return () => new Promise<RemoveProjectOutcome>(() => undefined);
}
