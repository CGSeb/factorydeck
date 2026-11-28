import type { ReactElement } from 'react';
import type { Account, LoadMe } from './auth-api.ts';
import type { SessionGate } from './auth-gate.ts';
import {
  type ResetFormProps,
  type ResetFormState,
  type ResetPageProps,
  useResetForm,
  useResetScreen,
} from './reset-page-state.ts';
import { LINK_GONE, type ReadReset, type SaveReset } from './reset-api.ts';
import { PASSWORD_HINT } from './SetupPage.tsx';
import { AuthBrand } from './SignInPage.tsx';
import { UnreachableScreen } from './UnreachableScreen.tsx';
import './components/controls.css';
import './components/layout.css';
import './shell.css';
import './setup-page.css';

export const RESET_TITLE = 'Choose a new password';
export const NEW_PASSWORD = 'New password';
export const SAVE_PASSWORD = 'Save password';
export const SAVING = 'Saving…';

export function signedInLine(name: string): string {
  return `You are signed in as ${name}. Saving signs you out.`;
}

export function LinkGone(): ReactElement {
  return (
    <main className="fd-setup">
      <section className="fd-setup-card" aria-label="Password reset">
        <AuthBrand />
        <p className="fd-reset-gone" role="alert">
          {LINK_GONE}
        </p>
      </section>
    </main>
  );
}

function PasswordField({ form }: { form: ResetFormState }): ReactElement {
  const { input, password, invalid, setPassword } = form;
  return (
    <div className="fd-setup-field fd-auth-field">
      <label htmlFor="fd-reset-password">{NEW_PASSWORD}</label>
      <input
        ref={input}
        id="fd-reset-password"
        name="password"
        type="password"
        autoComplete="new-password"
        value={password}
        aria-invalid={invalid}
        aria-describedby={
          invalid
            ? 'fd-reset-password-hint fd-reset-error'
            : 'fd-reset-password-hint'
        }
        onChange={(event) => {
          setPassword(event.currentTarget.value);
        }}
      />
      <p id="fd-reset-password-hint" className="fd-setup-hint">
        {PASSWORD_HINT}
      </p>
    </div>
  );
}

function ResetForm(props: ResetFormProps): ReactElement {
  const { email, signedInAs } = props;
  const form = useResetForm(props);
  const { sending, button, error, submit } = form;
  return (
    <main className="fd-setup">
      <form
        className="fd-setup-card"
        aria-labelledby="fd-reset-title"
        aria-busy={sending}
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <AuthBrand />
        <h1 id="fd-reset-title" className="fd-setup-title">
          {RESET_TITLE}
        </h1>
        <p className="fd-setup-text fd-reset-email">{email}</p>
        {signedInAs === undefined ? null : (
          <p className="fd-setup-text fd-reset-signed-in">
            {signedInLine(signedInAs)}
          </p>
        )}
        <PasswordField form={form} />
        <button
          ref={button}
          type="submit"
          className="fd-control fd-setup-submit"
          disabled={sending}
        >
          {sending ? SAVING : SAVE_PASSWORD}
        </button>
        <p
          id="fd-reset-error"
          className="fd-setup-error fd-setup-form-error"
          role="alert"
        >
          {error}
        </p>
      </form>
    </main>
  );
}

export function ResetPage({
  token,
  readReset,
  saveReset,
  loadMe,
  onSaved,
}: ResetPageProps): ReactElement | null {
  const [screen, retry, gone] = useResetScreen(token, readReset, loadMe);
  switch (screen.name) {
    case 'loading':
      return null;
    case 'gone':
      return <LinkGone />;
    case 'unreachable':
      return (
        <UnreachableScreen
          message={screen.message}
          retrying={screen.retrying}
          onRetry={retry}
        />
      );
    case 'form':
      return (
        <ResetForm
          token={token ?? ''}
          email={screen.email}
          signedInAs={screen.signedInAs}
          saveReset={saveReset}
          onSaved={onSaved}
          onGone={gone}
        />
      );
  }
}
const RESET_PATH = /^\/reset(?:\/(?<token>.*))?$/;

export interface ResetScreenSources {
  readReset?: ReadReset | undefined;
  saveReset?: SaveReset | undefined;
  loadMe?: LoadMe | undefined;
  sessionGate?: SessionGate | undefined;
}

export function resetScreen(
  { readReset, saveReset, loadMe, sessionGate }: ResetScreenSources,
  pathname: string,
  onSaved: (account: Account) => void,
): ReactElement | undefined {
  const reset = RESET_PATH.exec(pathname);
  if (reset === null || readReset === undefined || saveReset === undefined) {
    return undefined;
  }
  return (
    <ResetPage
      key={pathname}
      token={reset.groups?.['token']}
      readReset={readReset}
      saveReset={saveReset}
      loadMe={loadMe}
      onSaved={(account) => {
        sessionGate?.reopen();
        onSaved(account);
      }}
    />
  );
}
