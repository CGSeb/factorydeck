import { type ReactElement, useCallback, useState } from 'react';
import { Link, Route } from 'react-router';
import { AddProjectDialog, ADD_PROJECT_TITLE } from './AddProjectDialog.tsx';
import { DataTable } from './components/DataTable.tsx';
import { PageHeader } from './components/PageHeader.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { formatDateTime } from './format.ts';
import { useProject, withProject } from './project-param.ts';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import type {
  AddProject,
  LoadProjects,
  ProjectsView,
  SaveProject,
  TeamProject,
} from './projects-api.ts';
import {
  NO_PROJECT,
  PROJECTS_REFUSED,
  formatAddedDate,
  projectSettingsPath,
  projectsSummary,
  withAdded,
} from './projects-view.ts';
import { ProjectSettingsPage } from './ProjectSettingsPage.tsx';
import { useRefreshing } from './skills-api.ts';
import './invitations.css';
import './projects.css';

export interface ProjectsPageProps {
  loadProjects: LoadProjects;
  addProject?: AddProject | undefined;
}

const LOADING = 'Loading…';

type ListView =
  | Exclude<ProjectsView, { status: 'ok' }>
  | { status: 'ok'; projects: readonly TeamProject[] };

function ProjectsTable({
  projects,
}: {
  projects: readonly TeamProject[];
}): ReactElement {
  const selected = useProject();
  return (
    <DataTable label="Projects">
      <table className="fd-projects-table" aria-label="Projects">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Remote</th>
            <th scope="col">Slug</th>
            <th scope="col">Added</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id}>
              <th scope="row">
                <Link
                  className="fd-projects-link"
                  to={withProject(projectSettingsPath(project.slug), selected)}
                >
                  {project.name}
                </Link>
              </th>
              <td className="fd-projects-remote">{project.remote}</td>
              <td>{project.slug}</td>
              <td>
                <time
                  dateTime={project.createdAt}
                  title={formatDateTime(project.createdAt)}
                >
                  {formatAddedDate(project.createdAt)}
                </time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTable>
  );
}

function ProjectsContent({
  view,
}: {
  view: ListView | undefined;
}): ReactElement {
  if (view === undefined) return <StatusLine>{LOADING}</StatusLine>;
  if (view.status === 'refused') {
    return <StatusLine>{PROJECTS_REFUSED}</StatusLine>;
  }
  if (view.status === 'unreachable') {
    return <StatusLine>{UNREACHABLE_MESSAGE}</StatusLine>;
  }
  if (view.projects.length === 0) {
    return <StatusLine>{NO_PROJECT}</StatusLine>;
  }
  return <ProjectsTable projects={view.projects} />;
}

function useProjects(loadProjects: LoadProjects): {
  view: ListView | undefined;
  added: (project: TeamProject) => void;
} {
  const [version, setVersion] = useState(0);
  const [local, setLocal] = useState<readonly TeamProject[]>([]);
  const loaded = useRefreshing(
    `projects:${String(version)}`,
    loadProjects,
    'projects',
  );
  const view: ListView | undefined =
    loaded?.status === 'ok'
      ? { status: 'ok', projects: withAdded(loaded.projects, local) }
      : loaded;
  const added = useCallback((project: TeamProject) => {
    setLocal((previous) => [...previous, project]);
    setVersion((previous) => previous + 1);
  }, []);
  return { view, added };
}

export function ProjectsPage({
  loadProjects,
  addProject,
}: ProjectsPageProps): ReactElement {
  const { view, added } = useProjects(loadProjects);
  const [adding, setAdding] = useState(false);
  const close = useCallback(() => {
    setAdding(false);
  }, []);
  return (
    <div className="fd-projects-page">
      <PageHeader
        title="Projects"
        {...(view?.status === 'ok'
          ? { summary: projectsSummary(view.projects) }
          : {})}
        pending={view === undefined}
        {...(addProject !== undefined && view?.status === 'ok'
          ? {
              slot: (
                <button
                  type="button"
                  className="fd-control fd-invite-button"
                  onClick={() => {
                    setAdding(true);
                  }}
                >
                  {ADD_PROJECT_TITLE}
                </button>
              ),
            }
          : {})}
      />
      <ProjectsContent view={view} />
      {adding && addProject !== undefined && (
        <AddProjectDialog
          addProject={addProject}
          onAdded={(project) => {
            added(project);
            setAdding(false);
          }}
          onClose={close}
        />
      )}
    </div>
  );
}

export function projectsRoute({
  loadProjects,
  addProject,
  saveProject,
}: {
  loadProjects?: LoadProjects | undefined;
  addProject?: AddProject | undefined;
  saveProject?: SaveProject | undefined;
}): ReactElement | undefined {
  if (loadProjects === undefined) return undefined;
  return (
    <>
      <Route
        path="projects"
        element={
          <ProjectsPage loadProjects={loadProjects} addProject={addProject} />
        }
      />
      {saveProject !== undefined && (
        <Route
          path="projects/:slug"
          element={
            <ProjectSettingsPage
              loadProjects={loadProjects}
              saveProject={saveProject}
            />
          }
        />
      )}
    </>
  );
}
