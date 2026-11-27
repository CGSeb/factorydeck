import type { ReactElement } from 'react';
import { DEAD_INVITATION } from '../team/types.ts';
import type { SessionGate } from './auth-gate.ts';
import type { AuthPhase } from './auth-phase.ts';
import {
  type AcceptForm,
  inviteToken,
  useAcceptForm,
  useInvitationRead,
} from './invite-page-state.ts';
import type {
  AcceptField,
  AcceptInvitation,
  ReadInvitation,
} from './invitations-api.ts';
import { AuthBrand } from './SignInPage.tsx';
import { UnreachableScreen } from './UnreachableScreen.tsx';
import './components/controls.css';
import './components/layout.css';
import './shell.css';
import './setup-page.css';
import './invitations.css';

export const JOIN_TITLE = 'Join FactoryDeck';
export const CREATE_ACCOUNT = 'Create account';
export const CREATING_ACCOUNT = 'Creating account…';
export const PASSWORD_HINT = 'At least 12 characters';
export const READING = 'Reading the invitation…';
export { DEAD_INVITATION };

export function signedInLine(name: string): string {
  return `You are signed in as ${name}. Creating this account signs you out.`;
}

export interface InvitePageProps {
  token: string;
  readInvitation: ReadInvitation;
  acceptInvitation: AcceptInvitation;
  signedInAs?: string | undefined;
  onCreated: () => void;
}

interface FieldSpec {
  field: AcceptField;
  label: string;
  type: string;
  autoComplete: string;
  hint?: string;
}

const FIELDS: readonly FieldSpec[] = [
  { field: 'name', label: 'Name', type: 'text', autoComplete: 'name' },
  {
    field: 'password',
    label: 'Password',
    type: 'password',
    autoComplete: 'new-password',
    hint: PASSWORD_HINT,
  },
];

function FieldRow({
  spec: { field, label, type, autoComplete, hint },
  value,
  error,
  inputRef,
  onChange,
}: {
  spec: FieldSpec;
  value: string;
  error: string | undefined;
  inputRef: (element: HTMLInputElement | null) => void;
  onChange: (value: string) => void;
}): ReactElement {
  const id = `fd-invite-${field}`;
  const described = [
    hint === undefined ? undefined : `${id}-hint`,
    error === undefined ? undefined : `${id}-error`,
  ]
    .filter((part) => part !== undefined)
    .join(' ');
  return (
    <div className="fd-setup-field">
      <label htmlFor={id}>{label}</label>
      <input
        ref={inputRef}
        id={id}
        name={field}
        type={type}
        autoComplete={autoComplete}
        value={value}
        aria-invalid={error !== undefined}
        aria-describedby={described === '' ? undefined : described}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      {hint === undefined ? null : (
        <p id={`${id}-hint`} className="fd-setup-hint">
          {hint}
        </p>
      )}
      <p id={`${id}-error`} className="fd-setup-error" role="alert">
        {error}
      </p>
    </div>
  );
}

function DeadLink(): ReactElement {
  return (
    <main className="fd-setup">
      <section className="fd-setup-card" aria-label={JOIN_TITLE}>
        <AuthBrand />
        <h1 className="fd-setup-title fd-auth-title">{JOIN_TITLE}</h1>
        <p className="fd-invite-dead" role="alert">
          {DEAD_INVITATION}
        </p>
      </section>
    </main>
  );
}

function JoinForm({
  token,
  email,
  signedInAs,
  acceptInvitation,
  onCreated,
  onDead,
}: {
  token: string;
  email: string;
  signedInAs: string | undefined;
  acceptInvitation: AcceptInvitation;
  onCreated: () => void;
  onDead: () => void;
}): ReactElement {
  const form = useAcceptForm(token, acceptInvitation, onCreated, onDead);
  return (
    <main className="fd-setup">
      <form
        className="fd-setup-card"
        aria-labelledby="fd-invite-title"
        aria-busy={form.sending}
        noValidate
        onSubmit={(event) => void form.submit(event)}
      >
        <AuthBrand />
        <h1 id="fd-invite-title" className="fd-setup-title fd-auth-title">
          {JOIN_TITLE}
        </h1>
        {signedInAs !== undefined && (
          <p className="fd-setup-text fd-invite-signed-in">
            {signedInLine(signedInAs)}
          </p>
        )}
        <InvitedEmail email={email} />
        <JoinFields form={form} />
      </form>
    </main>
  );
}

function InvitedEmail({ email }: { email: string }): ReactElement {
  return (
    <div className="fd-setup-field fd-invite-email">
      <span className="fd-invite-email-label">Email</span>
      <span className="fd-invite-email-value">{email}</span>
      <input
        type="email"
        name="username"
        autoComplete="username"
        value={email}
        aria-label="Email"
        tabIndex={-1}
        readOnly
        hidden
      />
    </div>
  );
}

function JoinFields({
  form: { values, errors, sending, inputs, button, change },
}: {
  form: AcceptForm;
}): ReactElement {
  return (
    <>
      {FIELDS.map((spec) => (
        <FieldRow
          key={spec.field}
          spec={spec}
          value={values[spec.field]}
          error={errors[spec.field]}
          inputRef={(element) => {
            inputs.current[spec.field] = element;
          }}
          onChange={(value) => change(spec.field, value)}
        />
      ))}
      <button
        ref={button}
        type="submit"
        className="fd-control fd-setup-submit"
        disabled={sending}
      >
        {sending ? CREATING_ACCOUNT : CREATE_ACCOUNT}
      </button>
      <p className="fd-setup-error fd-setup-form-error" role="alert">
        {errors.form}
      </p>
    </>
  );
}

export function InvitePage({
  token,
  readInvitation,
  acceptInvitation,
  signedInAs,
  onCreated,
}: InvitePageProps): ReactElement {
  const [read, retrying, retry, markDead] = useInvitationRead(
    token,
    readInvitation,
  );
  if (read === undefined) {
    return (
      <main className="fd-setup" aria-busy="true">
        <p className="fd-visually-hidden" role="status">
          {READING}
        </p>
      </main>
    );
  }
  if (read.status === 'unreachable') {
    return (
      <UnreachableScreen
        message={read.message}
        retrying={retrying}
        onRetry={retry}
      />
    );
  }
  if (read.status === 'dead') return <DeadLink />;
  return (
    <JoinForm
      token={token}
      email={read.email}
      signedInAs={signedInAs}
      acceptInvitation={acceptInvitation}
      onCreated={onCreated}
      onDead={markDead}
    />
  );
}

export interface InviteScreenSources {
  readInvitation?: ReadInvitation | undefined;
  acceptInvitation?: AcceptInvitation | undefined;
  sessionGate?: SessionGate | undefined;
}

export function inviteScreen(
  pathname: string,
  phase: AuthPhase,
  { readInvitation, acceptInvitation, sessionGate }: InviteScreenSources,
  enter: () => void,
): ReactElement | undefined {
  const token = inviteToken(pathname);
  if (
    token === undefined ||
    readInvitation === undefined ||
    acceptInvitation === undefined ||
    (phase.name !== 'signed-out' && phase.name !== 'ready')
  ) {
    return undefined;
  }
  return (
    <InvitePage
      key={token}
      token={token}
      readInvitation={readInvitation}
      acceptInvitation={acceptInvitation}
      signedInAs={phase.name === 'ready' ? phase.account?.name : undefined}
      onCreated={() => {
        sessionGate?.reopen();
        enter();
      }}
    />
  );
}
