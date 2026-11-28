import { type ReactElement, useCallback, useId, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { Field } from './AddProjectDialog.tsx';
import { PageHeader } from './components/PageHeader.tsx';
import { Panel } from './components/Panel.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { GitHostSection } from './GitHostSection.tsx';
import type { RemoveToken, SaveToken } from './git-host-token-api.ts';
import { renderRouterLink } from './Layout.tsx';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import { useProject, withProject } from './project-param.ts';
import {
  SAVE,
  SAVED,
  SAVING,
  type SettingsForm,
  useSettingsForm,
} from './project-settings-form.ts';
import type {
  ListedProject,
  LoadProjects,
  ProjectsView,
  SaveProject,
} from './projects-api.ts';
import {
  PROJECTS_REFUSED,
  noProject,
  projectSummary,
} from './projects-view.ts';
import type { LoadRoleRules, SaveRoleRules } from './role-rules-api.ts';
import { RoleRulesSection } from './RoleRulesSection.tsx';
import {
  SettingsLeavePrompt,
  type Unsaved,
  type UnsavedSection,
} from './SettingsLeavePrompt.tsx';
import { useRefreshing } from './skills-api.ts';
import './invitations.css';
import './projects.css';

export interface ProjectSettingsPageProps {
  loadProjects: LoadProjects;
  saveProject: SaveProject;
  loadRoleRules?: LoadRoleRules | undefined;
  saveRoleRules?: SaveRoleRules | undefined;
  saveToken?: SaveToken | undefined;
  removeToken?: RemoveToken | undefined;
}

const LOADING = 'Loading…';
const PROJECTS_PATH = '/projects';

function SaveActions({ form }: { form: SettingsForm }): ReactElement {
  return (
    <>
      <p className="fd-setup-error" role="alert">
        {form.errors.form}
      </p>
      <div className="fd-project-settings-actions">
        <button
          type="submit"
          className="fd-control fd-dialog-button"
          data-primary="true"
          disabled={form.saving || !form.changed}
        >
          {form.saving ? SAVING : SAVE}
        </button>
        <span className="fd-project-settings-saved" role="status">
          {form.saved ? SAVED : ''}
        </span>
      </div>
      <p className="fd-setup-error fd-project-settings-missing" role="alert">
        {form.errors.missing}
      </p>
    </>
  );
}

function GeneralSection({
  project,
  saveProject,
  onSaved,
}: {
  project: ListedProject;
  saveProject: SaveProject;
  onSaved: (project: ListedProject) => void;
}): ReactElement {
  const id = useId();
  const name = useRef<HTMLInputElement | null>(null);
  const remote = useRef<HTMLInputElement | null>(null);
  const form = useSettingsForm(project, saveProject, onSaved, { name, remote });
  return (
    <Panel heading="General">
      <form
        className="fd-project-settings-form"
        noValidate
        aria-busy={form.saving}
        onSubmit={(event) => void form.submit(event)}
      >
        <Field
          id={id}
          field="name"
          label="Name"
          value={form.values.name}
          error={form.errors.name}
          input={(element) => {
            name.current = element;
          }}
          onChange={(value) => {
            form.change('name', value);
          }}
        />
        <Field
          id={id}
          field="remote"
          label="Git remote"
          value={form.values.remote}
          error={form.errors.remote}
          input={(element) => {
            remote.current = element;
          }}
          onChange={(value) => {
            form.change('remote', value);
          }}
        />
        <SaveActions form={form} />
      </form>
    </Panel>
  );
}

function SettingsContent({
  view,
  slug,
  project,
  section,
}: {
  view: ProjectsView | undefined;
  slug: string;
  project: ListedProject | undefined;
  section: (project: ListedProject) => ReactElement;
}): ReactElement {
  if (view === undefined) return <StatusLine>{LOADING}</StatusLine>;
  if (view.status === 'refused') {
    return <StatusLine>{PROJECTS_REFUSED}</StatusLine>;
  }
  if (view.status === 'unreachable') {
    return <StatusLine>{UNREACHABLE_MESSAGE}</StatusLine>;
  }
  if (project === undefined) return <StatusLine>{noProject(slug)}</StatusLine>;
  return section(project);
}

function useSettings(loadProjects: LoadProjects, slug: string) {
  const [version, setVersion] = useState(0);
  const view = useRefreshing(
    `project-settings:${String(version)}`,
    loadProjects,
    'projects',
  );
  const [saved, setSaved] = useState<{
    from: ProjectsView;
    project: ListedProject;
  }>();
  const found =
    view?.status === 'ok'
      ? view.projects.find((project) => project.slug === slug)
      : undefined;
  const project =
    saved !== undefined && saved.from === view && saved.project.slug === slug
      ? saved.project
      : found;
  const onSaved = (next: ListedProject): void => {
    if (view === undefined) return;
    setSaved({ from: view, project: next });
    setVersion((previous) => previous + 1);
  };
  return { view, project, onSaved };
}

function useUnsaved(): {
  unsaved: Unsaved;
  onRulesChanged: (changed: boolean) => void;
  onGitHostChanged: (changed: boolean) => void;
} {
  const [unsaved, setUnsaved] = useState<Unsaved>({});
  const report = useCallback((section: UnsavedSection, changed: boolean) => {
    setUnsaved((previous) =>
      previous[section] === changed
        ? previous
        : { ...previous, [section]: changed },
    );
  }, []);
  const onRulesChanged = useCallback(
    (changed: boolean) => {
      report('rules', changed);
    },
    [report],
  );
  const onGitHostChanged = useCallback(
    (changed: boolean) => {
      report('gitHost', changed);
    },
    [report],
  );
  return { unsaved, onRulesChanged, onGitHostChanged };
}

function LaterSections({
  project,
  secretKey,
  sources: { loadRoleRules, saveRoleRules, saveToken, removeToken },
  onSaved,
  onRulesChanged,
  onGitHostChanged,
}: {
  project: ListedProject;
  secretKey: boolean;
  sources: Omit<ProjectSettingsPageProps, 'loadProjects' | 'saveProject'>;
  onSaved: (project: ListedProject) => void;
  onRulesChanged: (changed: boolean) => void;
  onGitHostChanged: (changed: boolean) => void;
}): ReactElement {
  return (
    <>
      {loadRoleRules !== undefined && saveRoleRules !== undefined && (
        <RoleRulesSection
          key={`rules-${String(project.id)}`}
          project={project}
          loadRoleRules={loadRoleRules}
          saveRoleRules={saveRoleRules}
          onChanged={onRulesChanged}
        />
      )}
      {saveToken !== undefined && removeToken !== undefined && (
        <GitHostSection
          key={`git-host-${String(project.id)}`}
          project={project}
          secretKey={secretKey}
          saveToken={saveToken}
          removeToken={removeToken}
          onSaved={onSaved}
          onChanged={onGitHostChanged}
        />
      )}
    </>
  );
}

export function ProjectSettingsPage({
  loadProjects,
  saveProject,
  ...sources
}: ProjectSettingsPageProps): ReactElement {
  const { slug = '' } = useParams();
  const selected = useProject();
  const { view, project, onSaved } = useSettings(loadProjects, slug);
  const secretKey = view?.status === 'ok' && view.secretKey;
  const { unsaved, ...changes } = useUnsaved();
  return (
    <div className="fd-projects-page">
      <PageHeader
        back={{ label: 'Projects', href: withProject(PROJECTS_PATH, selected) }}
        title={project?.name ?? slug}
        {...(project === undefined ? {} : { summary: projectSummary(project) })}
        pending={view === undefined}
        renderLink={renderRouterLink}
      />
      <SettingsContent
        view={view}
        slug={slug}
        project={project}
        section={(shown) => (
          <>
            <GeneralSection
              key={shown.id}
              project={shown}
              saveProject={saveProject}
              onSaved={onSaved}
            />
            <LaterSections
              key={`later-${String(shown.id)}`}
              project={shown}
              secretKey={secretKey}
              sources={sources}
              onSaved={onSaved}
              {...changes}
            />
          </>
        )}
      />
      <SettingsLeavePrompt unsaved={unsaved} />
    </div>
  );
}
