import { type ReactElement, useId, useRef } from 'react';
import { Dialog } from './components/Dialog.tsx';
import { Panel } from './components/Panel.tsx';
import { formatDateTime } from './format.ts';
import {
  type GitHostForm,
  type GitHostSources,
  hostChoice,
  useGitHostForm,
} from './git-host-form.ts';
import {
  CHECKING,
  CHOOSE,
  GIT_HOST,
  HOST_LABELS,
  NO_KEY_MESSAGE,
  NO_TOKEN,
  REMOVE_TOKEN,
  REMOVING,
  SAVE_TOKEN,
  STOP_UPDATING,
  removeQuestion,
  tokenSetBy,
} from './git-host-view.ts';
import { errorProps } from './invite-dialog-state.ts';
import { useReportChanged } from './leave-guard.ts';
import type { ListedProject } from './projects-api.ts';
import { formatAddedDate } from './projects-view.ts';
import './invitations.css';
import './projects.css';
import './setup-page.css';

export interface GitHostSectionProps extends GitHostSources {
  project: ListedProject;
  secretKey: boolean;
  onSaved: (project: ListedProject) => void;
  onChanged?: ((changed: boolean) => void) | undefined;
}

function TokenStateLine({ project }: { project: ListedProject }): ReactElement {
  const at = project.tokenSetAt;
  return (
    <p className="fd-git-host-state">
      {project.tokenSet && at !== null ? (
        <>
          Token set on{' '}
          <time dateTime={at} title={formatDateTime(at)}>
            {formatAddedDate(at)}
          </time>
          {tokenSetBy(project)}
        </>
      ) : (
        NO_TOKEN
      )}
    </p>
  );
}

function HostField({
  id,
  form,
  select,
}: {
  id: string;
  form: GitHostForm;
  select: (element: HTMLSelectElement | null) => void;
}): ReactElement {
  const fieldId = `${id}-gitHost`;
  if (form.readOnly !== undefined) {
    return (
      <dl className="fd-git-host-host">
        <dt>Host</dt>
        <dd>{HOST_LABELS[form.readOnly]}</dd>
      </dl>
    );
  }
  return (
    <div className="fd-setup-field">
      <label htmlFor={fieldId}>Host</label>
      <select
        ref={select}
        id={fieldId}
        name="gitHost"
        className="fd-invite-select"
        value={form.host}
        {...errorProps(fieldId, form.errors.gitHost)}
        onChange={(event) => {
          form.changeHost(hostChoice(event.currentTarget.value));
        }}
      >
        {form.host === '' && <option value="">{CHOOSE}</option>}
        <option value="github">{HOST_LABELS.github}</option>
        <option value="gitlab">{HOST_LABELS.gitlab}</option>
      </select>
      <p id={`${fieldId}-error`} className="fd-setup-error" role="alert">
        {form.errors.gitHost}
      </p>
    </div>
  );
}

function TokenField({
  id,
  form,
  input,
}: {
  id: string;
  form: GitHostForm;
  input: (element: HTMLInputElement | null) => void;
}): ReactElement {
  const fieldId = `${id}-token`;
  return (
    <div className="fd-setup-field">
      <label htmlFor={fieldId}>Token</label>
      <input
        ref={input}
        id={fieldId}
        name="token"
        type="password"
        autoComplete="new-password"
        spellCheck={false}
        value={form.token}
        {...errorProps(fieldId, form.errors.token)}
        onChange={(event) => {
          form.changeToken(event.currentTarget.value);
        }}
      />
      <p id={`${fieldId}-error`} className="fd-setup-error" role="alert">
        {form.errors.token}
      </p>
    </div>
  );
}

function TokenActions({ form }: { form: GitHostForm }): ReactElement {
  return (
    <>
      <div className="fd-project-settings-actions fd-git-host-actions">
        <button
          type="submit"
          className="fd-control fd-dialog-button"
          data-primary="true"
          disabled={!form.canSave}
        >
          {form.checking ? CHECKING : SAVE_TOKEN}
        </button>
        <button
          type="button"
          className="fd-control fd-dialog-button fd-git-host-remove"
          disabled={!form.canRemove}
          onClick={form.openRemoval}
        >
          {REMOVE_TOKEN}
        </button>
        <span className="fd-project-settings-saved" role="status">
          {form.checked}
        </span>
      </div>
      <p className="fd-setup-error fd-project-settings-missing" role="alert">
        {form.errors.form}
      </p>
    </>
  );
}

function RemoveTokenDialog({
  name,
  form,
}: {
  name: string;
  form: GitHostForm;
}): ReactElement | undefined {
  const { removal } = form;
  if (removal === undefined) return undefined;
  const removing = removal.state === 'removing';
  return (
    <Dialog
      title={removeQuestion(name)}
      text={STOP_UPDATING}
      cancelLabel="Cancel"
      onCancel={form.closeRemoval}
      danger={{
        label: removing ? REMOVING : REMOVE_TOKEN,
        onClick: () => void form.confirmRemoval(),
        disabled: removing,
      }}
    >
      {removal.state === 'failed' ? (
        <p className="fd-dialog-message" role="alert">
          {removal.message}
        </p>
      ) : undefined}
    </Dialog>
  );
}

export function GitHostSection({
  project,
  secretKey,
  saveToken,
  removeToken,
  onSaved,
  onChanged,
}: GitHostSectionProps): ReactElement {
  const id = useId();
  const token = useRef<HTMLInputElement | null>(null);
  const gitHost = useRef<HTMLSelectElement | null>(null);
  const form = useGitHostForm({
    project,
    secretKey,
    sources: { saveToken, removeToken },
    onSaved,
    inputs: { token, gitHost },
  });
  useReportChanged(form.changed, onChanged);
  return (
    <Panel heading={GIT_HOST}>
      <form
        className="fd-project-settings-form"
        noValidate
        aria-busy={form.checking}
        onSubmit={(event) => void form.save(event)}
      >
        <HostField
          id={id}
          form={form}
          select={(element) => {
            gitHost.current = element;
          }}
        />
        <TokenStateLine project={project} />
        {form.keyMissing && (
          <p className="fd-setup-hint fd-git-host-no-key">{NO_KEY_MESSAGE}</p>
        )}
        <TokenField
          id={id}
          form={form}
          input={(element) => {
            token.current = element;
          }}
        />
        <TokenActions form={form} />
      </form>
      <RemoveTokenDialog name={project.name} form={form} />
    </Panel>
  );
}
