import { type ReactElement, useCallback, useState } from 'react';
import { Link, Route } from 'react-router';
import { AddProjectDialog, ADD_PROJECT_TITLE } from './AddProjectDialog.tsx';
import { DataTable } from './components/DataTable.tsx';
import { PageHeader } from './components/PageHeader.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { formatDateTime } from './format.ts';
import type { RemoveToken, SaveToken } from './git-host-token-api.ts';
import { GIT_HOST, gitHostCell } from './git-host-view.ts';
import { useProject, withProject } from './project-param.ts';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import { useProjectRemoved } from './layout-outlet.ts';
import type {
  AddProject,
  LoadProjects,
  SaveProject,
  RemoveProject,
} from './projects-api.ts';
import {
  NO_PROJECT,
  PROJECTS_REFUSED,
  formatAddedDate,
  projectSettingsPath,
  addRemoteValue,
  projectsSummary,
} from './projects-view.ts';
import { ProjectSettingsPage } from './ProjectSettingsPage.tsx';
import type { LoadRoleRules, SaveRoleRules } from './role-rules-api.ts';
import { type ProjectRow, useRemoval } from './project-removal.ts';
import { RemoveProjectDialog } from './RemoveProjectDialog.tsx';
import { RemotesNotAdded } from './RemotesNotAdded.tsx';
import { type ListView, useProjects } from './use-projects.ts';
import { useNow } from './use-now.ts';
import './invitations.css';
import './projects.css';

export interface ProjectsPageProps {
  loadProjects: LoadProjects;
  addProject?: AddProject | undefined;
  removeProject?: RemoveProject | undefined;
  onRemoved?: ((slug: string) => void) | undefined;
  now?: Date | undefined;
}

const LOADING = 'Loading…';

function RemoveCell({
  project,
  onRemove,
}: {
  project: ProjectRow;
  onRemove: (project: ProjectRow) => void;
}): ReactElement {
  return (
    <td className="fd-projects-actions">
      <button
        type="button"
        className="fd-control fd-invitation-button"
        aria-label={`Remove ${project.name}`}
        onClick={() => {
          onRemove(project);
        }}
      >
        Remove
      </button>
    </td>
  );
}

function ProjectsTable({
  projects,
  onRemove,
}: {
  projects: readonly ProjectRow[];
  onRemove: ((project: ProjectRow) => void) | undefined;
}): ReactElement {
  const selected = useProject();
  return (
    <DataTable label="Projects">
      <table className="fd-projects-table" aria-label="Projects">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Remote</th>
            <th scope="col">{GIT_HOST}</th>
            <th scope="col">Slug</th>
            <th scope="col">Added</th>
            {onRemove !== undefined && (
              <th scope="col">
                <span className="fd-visually-hidden">Actions</span>
              </th>
            )}
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
              <td>{gitHostCell(project)}</td>
              <td>{project.slug}</td>
              <td>
                <time
                  dateTime={project.createdAt}
                  title={formatDateTime(project.createdAt)}
                >
                  {formatAddedDate(project.createdAt)}
                </time>
              </td>
              {onRemove !== undefined && (
                <RemoveCell project={project} onRemove={onRemove} />
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </DataTable>
  );
}

function ProjectsContent({
  view,
  onRemove,
}: {
  view: ListView | undefined;
  onRemove: ((project: ProjectRow) => void) | undefined;
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
  return <ProjectsTable projects={view.projects} onRemove={onRemove} />;
}

function RemovalDialog({
  removal,
}: {
  removal: ReturnType<typeof useRemoval>;
}): ReactElement | undefined {
  const current = removal.removal;
  if (current === undefined) return undefined;
  return (
    <RemoveProjectDialog
      name={current.project.name}
      sessions={current.sessions}
      state={current.state}
      onCancel={removal.close}
      onConfirm={() => void removal.confirm(current)}
    />
  );
}

function ProjectsHeader({
  view,
  onAdd,
}: {
  view: ListView | undefined;
  onAdd: (() => void) | undefined;
}): ReactElement {
  return (
    <PageHeader
      title="Projects"
      {...(view?.status === 'ok'
        ? {
            summary: projectsSummary(view.projects, view.pendingRemotes.length),
          }
        : {})}
      pending={view === undefined}
      {...(onAdd !== undefined && view?.status === 'ok'
        ? {
            slot: (
              <button
                type="button"
                className="fd-control fd-invite-button"
                onClick={onAdd}
              >
                {ADD_PROJECT_TITLE}
              </button>
            ),
          }
        : {})}
    />
  );
}

export function ProjectsPage({
  loadProjects,
  addProject,
  removeProject,
  onRemoved,
  now: fixedNow,
}: ProjectsPageProps): ReactElement {
  const { view, added, removed } = useProjects(loadProjects);
  const removal = useRemoval(loadProjects, removeProject, (project) => {
    removed(project);
    onRemoved?.(project.slug);
  });
  const now = useNow(fixedNow);
  const [adding, setAdding] = useState<string | undefined>(undefined);
  const close = useCallback(() => {
    setAdding(undefined);
  }, []);
  return (
    <div className="fd-projects-page">
      <ProjectsHeader
        view={view}
        onAdd={
          addProject === undefined
            ? undefined
            : () => {
                setAdding('');
              }
        }
      />
      <ProjectsContent view={view} onRemove={removal.open} />
      {view?.status === 'ok' && (
        <RemotesNotAdded
          pendingRemotes={view.pendingRemotes}
          noRemote={view.noRemote}
          now={now}
          onAdd={
            addProject === undefined
              ? undefined
              : (remote) => {
                  setAdding(addRemoteValue(remote));
                }
          }
        />
      )}
      <RemovalDialog removal={removal} />
      {adding !== undefined && addProject !== undefined && (
        <AddProjectDialog
          addProject={addProject}
          initialRemote={adding}
          onAdded={(project) => {
            added(project);
            setAdding(undefined);
          }}
          onClose={close}
        />
      )}
    </div>
  );
}

function ProjectsRoutePage(props: ProjectsPageProps): ReactElement {
  const onRemoved = useProjectRemoved();
  return <ProjectsPage {...props} onRemoved={onRemoved} />;
}

export interface ProjectsSources {
  loadProjects?: LoadProjects | undefined;
  addProject?: AddProject | undefined;
  saveProject?: SaveProject | undefined;
  removeProject?: RemoveProject | undefined;
  loadRoleRules?: LoadRoleRules | undefined;
  saveRoleRules?: SaveRoleRules | undefined;
  saveToken?: SaveToken | undefined;
  removeToken?: RemoveToken | undefined;
}

export function projectsRoute({
  loadProjects,
  addProject,
  saveProject,
  removeProject,
  loadRoleRules,
  saveRoleRules,
  saveToken,
  removeToken,
}: ProjectsSources): ReactElement | undefined {
  if (loadProjects === undefined) return undefined;
  return (
    <>
      <Route
        path="projects"
        element={
          <ProjectsRoutePage
            loadProjects={loadProjects}
            addProject={addProject}
            removeProject={removeProject}
          />
        }
      />
      {saveProject !== undefined && (
        <Route
          path="projects/:slug"
          element={
            <ProjectSettingsPage
              loadProjects={loadProjects}
              saveProject={saveProject}
              loadRoleRules={loadRoleRules}
              saveRoleRules={saveRoleRules}
              saveToken={saveToken}
              removeToken={removeToken}
            />
          }
        />
      )}
    </>
  );
}
