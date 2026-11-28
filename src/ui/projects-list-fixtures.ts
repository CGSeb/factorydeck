import type {
  AddProject,
  AddProjectOutcome,
  LoadProjects,
  ProjectsView,
  TeamProject,
} from './projects-api.ts';

export const someProjects: TeamProject[] = [
  {
    id: 2,
    name: 'atlas',
    slug: 'atlas',
    remote: 'gitlab.example.test/platform/tools/atlas',
    createdAt: '2026-02-03T09:00:00Z',
  },
  {
    id: 1,
    name: 'Billing',
    slug: 'billing-service',
    remote: 'github.com/example-org/billing-service',
    createdAt: '2026-01-15T14:20:00Z',
  },
  {
    id: 3,
    name: 'Website',
    slug: 'website',
    remote: 'github.com/example-org/website',
    createdAt: '2026-03-10T08:45:00Z',
  },
];

export const addedProject: TeamProject = {
  id: 4,
  name: 'factorydeck',
  slug: 'factorydeck',
  remote: 'github.com/example-org/factorydeck',
  createdAt: '2026-03-12T10:00:00Z',
};

export function projectsResponse(projects: TeamProject[]): ProjectsView {
  return { status: 'ok', refreshSeconds: 3600, projects };
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
