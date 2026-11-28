import {
  type FormEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
  useId,
  useRef,
  useState,
} from 'react';
import { FORM_STOPS, useDialogFocus } from './components/dialog-focus.ts';
import { errorProps } from './invite-dialog-state.ts';
import { DialogHeading } from './InviteLink.tsx';
import type {
  AddProject,
  ProjectField,
  ProjectInput,
  TeamProject,
} from './projects-api.ts';
import './components/controls.css';
import './components/layout.css';
import './setup-page.css';
import './invitations.css';

export const ADD_PROJECT_TITLE = 'Add project';
export const ADD_PROJECT_TEXT =
  'Give the git remote of a repository your team works on. Leave the name empty to use the repository name.';
export const REMOTE_PLACEHOLDER = 'git@github.com:owner/repo.git';
export const ADD = 'Add project';
export const ADDING = 'Adding…';
export const CANCEL = 'Cancel';

export interface AddProjectDialogProps {
  addProject: AddProject;
  onAdded: (project: TeamProject) => void;
  onClose: () => void;
  initialRemote?: string | undefined;
}

type Errors = Partial<Record<ProjectField | 'form', string>>;

export function Field({
  id,
  field,
  label,
  value,
  error,
  placeholder,
  input,
  onChange,
}: {
  id: string;
  field: ProjectField;
  label: string;
  value: string;
  error: string | undefined;
  placeholder?: string;
  input: (element: HTMLInputElement | null) => void;
  onChange: (value: string) => void;
}): ReactElement {
  const inputId = `${id}-${field}`;
  return (
    <div className="fd-setup-field">
      <label htmlFor={inputId}>{label}</label>
      <input
        ref={input}
        id={inputId}
        name={field}
        type="text"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        {...errorProps(inputId, error)}
        onChange={(event) => {
          onChange(event.currentTarget.value);
        }}
      />
      <p id={`${inputId}-error`} className="fd-setup-error" role="alert">
        {error}
      </p>
    </div>
  );
}

function useAddProjectForm(
  addProject: AddProject,
  onAdded: (project: TeamProject) => void,
  inputs: Record<ProjectField, RefObject<HTMLInputElement | null>>,
  initialRemote: string,
): {
  values: ProjectInput;
  change: (next: Partial<ProjectInput>) => void;
  errors: Errors;
  sending: boolean;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
} {
  const [values, setValues] = useState<ProjectInput>({
    remote: initialRemote,
    name: '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const busy = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setSending(true);
    setErrors({});
    const outcome = await addProject(values);
    busy.current = false;
    setSending(false);
    if (outcome.status === 'added') {
      onAdded(outcome.project);
      return;
    }
    if (outcome.status === 'invalid') {
      setErrors({ [outcome.field]: outcome.message });
      inputs[outcome.field].current?.focus();
      return;
    }
    setErrors({ form: outcome.message });
  }
  return {
    values,
    change: (next) => {
      setValues((previous) => ({ ...previous, ...next }));
    },
    errors,
    sending,
    submit,
  };
}

function ProjectFields({
  id,
  form,
  remote,
  name,
}: {
  id: string;
  form: ReturnType<typeof useAddProjectForm>;
  remote: (element: HTMLInputElement | null) => void;
  name: (element: HTMLInputElement | null) => void;
}): ReactElement {
  return (
    <div className="fd-invite-fields">
      <Field
        id={id}
        field="remote"
        label="Git remote"
        placeholder={REMOTE_PLACEHOLDER}
        value={form.values.remote}
        error={form.errors.remote}
        input={remote}
        onChange={(value) => {
          form.change({ remote: value });
        }}
      />
      <Field
        id={id}
        field="name"
        label="Name"
        value={form.values.name}
        error={form.errors.name}
        input={name}
        onChange={(value) => {
          form.change({ name: value });
        }}
      />
    </div>
  );
}

function FormActions({
  error,
  sending,
  onClose,
}: {
  error: string | undefined;
  sending: boolean;
  onClose: () => void;
}): ReactElement {
  return (
    <>
      <p className="fd-setup-error fd-invite-form-error" role="alert">
        {error}
      </p>
      <div className="fd-dialog-actions">
        <button
          type="button"
          className="fd-control fd-dialog-button"
          onClick={onClose}
        >
          {CANCEL}
        </button>
        <button
          type="submit"
          className="fd-control fd-dialog-button"
          data-primary="true"
          disabled={sending}
        >
          {sending ? ADDING : ADD}
        </button>
      </div>
    </>
  );
}

function DialogFrame({
  dialog,
  ids,
  onClose,
  children,
}: {
  dialog: RefObject<HTMLDivElement | null>;
  ids: { title: string; text: string };
  onClose: () => void;
  children: ReactNode;
}): ReactElement {
  return (
    <div
      className="fd-dialog-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        className="fd-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={ids.title}
        aria-describedby={ids.text}
      >
        {children}
      </div>
    </div>
  );
}

export function AddProjectDialog({
  addProject,
  onAdded,
  onClose,
  initialRemote = '',
}: AddProjectDialogProps): ReactElement {
  const id = useId();
  const ids = { title: `${id}-title`, text: `${id}-text` };
  const dialog = useRef<HTMLDivElement>(null);
  const first = useDialogFocus<HTMLInputElement>(
    onClose,
    dialog,
    false,
    FORM_STOPS,
  );
  const remote = useRef<HTMLInputElement | null>(null);
  const name = useRef<HTMLInputElement | null>(null);
  const form = useAddProjectForm(
    addProject,
    onAdded,
    { remote, name },
    initialRemote,
  );
  return (
    <DialogFrame dialog={dialog} ids={ids} onClose={onClose}>
      <form
        noValidate
        aria-busy={form.sending}
        onSubmit={(event) => void form.submit(event)}
      >
        <DialogHeading
          ids={ids}
          title={ADD_PROJECT_TITLE}
          text={ADD_PROJECT_TEXT}
        />
        <ProjectFields
          id={id}
          form={form}
          remote={(element) => {
            remote.current = element;
            first.current = element;
          }}
          name={(element) => {
            name.current = element;
          }}
        />
        <FormActions
          error={form.errors.form}
          sending={form.sending}
          onClose={onClose}
        />
      </form>
    </DialogFrame>
  );
}
