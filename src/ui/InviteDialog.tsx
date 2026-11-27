import { type ReactElement, type RefObject, useId, useRef } from 'react';
import type { Role } from './auth-api.ts';
import { FORM_STOPS, useDialogFocus } from './components/dialog-focus.ts';
import { type WriteClipboard, writeClipboard } from './frictions-api.ts';
import {
  type InviteForm as InviteFormState,
  errorProps,
  useInviteForm,
} from './invite-dialog-state.ts';
import {
  type CreatedInvitation,
  type InviteInput,
  type InviteOutcome,
} from './invitations-api.ts';
import './components/controls.css';
import './components/layout.css';
import './setup-page.css';
import './invitations.css';
import { DialogHeading, type Ids, InviteLink } from './InviteLink.tsx';

export { DONE, LINK_TITLE } from './InviteLink.tsx';

export {
  COPIED,
  COPIED_MS,
  COPY_FAILED,
  COPY_LINK,
  FAILED_MS,
} from './invite-dialog-state.ts';

export const INVITE_TITLE = 'Invite';
export const INVITE_TEXT =
  'Create a link that lets one person join with the role you choose. You send the link yourself.';
export const CREATE_INVITATION = 'Create invitation';
export const CREATING = 'Creating…';
export const CANCEL = 'Cancel';

export type InviteDialogView =
  { kind: 'form' } | { kind: 'link'; invitation: CreatedInvitation };

export interface InviteDialogProps {
  view: InviteDialogView;
  origin: string;
  invite: (input: InviteInput) => Promise<InviteOutcome>;
  onCreated: (invitation: CreatedInvitation) => void;
  onClose: () => void;
  copy?: WriteClipboard | undefined;
}

const ROLE_OPTIONS: readonly { value: Role; label: string }[] = [
  { value: 'dev', label: 'Dev' },
  { value: 'manager', label: 'Manager' },
];

function InviteFields({
  form,
  email,
  role,
}: {
  form: InviteFormState;
  email: (element: HTMLInputElement | null) => void;
  role: RefObject<HTMLSelectElement | null>;
}): ReactElement {
  const id = useId();
  return (
    <div className="fd-invite-fields">
      <div className="fd-setup-field">
        <label htmlFor={`${id}-email`}>Email</label>
        <input
          ref={email}
          id={`${id}-email`}
          name="email"
          type="email"
          autoComplete="off"
          value={form.values.email}
          {...errorProps(`${id}-email`, form.errors.email)}
          onChange={(event) => {
            form.change({ email: event.currentTarget.value });
          }}
        />
        <p id={`${id}-email-error`} className="fd-setup-error" role="alert">
          {form.errors.email}
        </p>
      </div>
      <div className="fd-setup-field">
        <label htmlFor={`${id}-role`}>Role</label>
        <select
          ref={role}
          id={`${id}-role`}
          name="role"
          className="fd-invite-select"
          value={form.values.role}
          {...errorProps(`${id}-role`, form.errors.role)}
          onChange={(event) => {
            form.change({
              role: event.currentTarget.value === 'manager' ? 'manager' : 'dev',
            });
          }}
        >
          {ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p id={`${id}-role-error`} className="fd-setup-error" role="alert">
          {form.errors.role}
        </p>
      </div>
    </div>
  );
}

function InviteForm({
  ids,
  invite,
  onCreated,
  onClose,
  first,
}: {
  ids: Ids;
  invite: InviteDialogProps['invite'];
  onCreated: InviteDialogProps['onCreated'];
  onClose: () => void;
  first: RefObject<HTMLElement | null>;
}): ReactElement {
  const email = useRef<HTMLInputElement | null>(null);
  const role = useRef<HTMLSelectElement | null>(null);
  const form = useInviteForm(invite, onCreated, { email, role });
  return (
    <form
      noValidate
      aria-busy={form.sending}
      onSubmit={(event) => void form.submit(event)}
    >
      <DialogHeading ids={ids} title={INVITE_TITLE} text={INVITE_TEXT} />
      <InviteFields
        form={form}
        email={(element) => {
          email.current = element;
          first.current = element;
        }}
        role={role}
      />
      <p className="fd-setup-error fd-invite-form-error" role="alert">
        {form.errors.form}
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
          disabled={form.sending}
        >
          {form.sending ? CREATING : CREATE_INVITATION}
        </button>
      </div>
    </form>
  );
}

export function InviteDialog({
  view,
  origin,
  invite,
  onCreated,
  onClose,
  copy = writeClipboard,
}: InviteDialogProps): ReactElement {
  const title = useId();
  const text = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const first = useDialogFocus<HTMLElement>(onClose, dialog, false, FORM_STOPS);
  const ids = { title, text };
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
        aria-labelledby={title}
        aria-describedby={text}
      >
        {view.kind === 'form' ? (
          <InviteForm
            ids={ids}
            invite={invite}
            onCreated={onCreated}
            onClose={onClose}
            first={first}
          />
        ) : (
          <InviteLink
            ids={ids}
            invitation={view.invitation}
            origin={origin}
            copy={copy}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}
