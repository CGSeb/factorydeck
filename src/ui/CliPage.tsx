import { type ReactElement, useEffect, useRef, useState } from 'react';
import { Route, useSearchParams } from 'react-router';
import type { CliLogin, DecideCliLogin, ReadCliLogin } from './cli-api.ts';
import { type CliScreen, useCliPage } from './cli-page-state.ts';
import { AuthBrand } from './SignInPage.tsx';
import './components/controls.css';
import './components/layout.css';
import './shell.css';
import './setup-page.css';
import './cli-page.css';

export const CLI_TITLE = 'Connect the FactoryDeck CLI';
export const CODE_LABEL = 'Code from your terminal';
export const CONTINUE = 'Continue';
export const CONNECT = 'Connect';
export const CANCEL = 'Cancel';
export const CONNECTED = 'Connected. You can go back to your terminal.';
export const CANCELLED = 'Cancelled.';

export function askLine({ machine, account }: CliLogin): string {
  return `${machine} asks to send sessions as ${account.name} (${account.email}).`;
}

export interface CliPageProps {
  code: string | undefined;
  readCliLogin: ReadCliLogin;
  decideCliLogin: DecideCliLogin;
}

function CodeForm({
  error,
  typed,
  reading,
  onCode,
}: {
  error: string | undefined;
  typed: string;
  reading: boolean;
  onCode: (code: string) => void;
}): ReactElement {
  const [code, setCode] = useState(typed);
  const input = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    input.current?.focus();
  }, [error]);
  const invalid = error !== undefined;
  return (
    <form
      noValidate
      aria-busy={reading}
      onSubmit={(event) => {
        event.preventDefault();
        if (!reading && code.trim() !== '') onCode(code);
      }}
    >
      <div className="fd-setup-field fd-auth-field">
        <label htmlFor="fd-cli-code">{CODE_LABEL}</label>
        <input
          ref={input}
          id="fd-cli-code"
          name="code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={code}
          aria-invalid={invalid}
          aria-describedby={invalid ? 'fd-cli-error' : undefined}
          onChange={(event) => {
            setCode(event.currentTarget.value);
          }}
        />
      </div>
      <button
        type="submit"
        className="fd-control fd-setup-submit fd-cli-submit"
        disabled={reading}
      >
        {CONTINUE}
      </button>
      <p
        id="fd-cli-error"
        className="fd-setup-error fd-setup-form-error"
        role="alert"
      >
        {error}
      </p>
    </form>
  );
}

function Ask({
  screen,
  decide,
}: {
  screen: Extract<CliScreen, { name: 'ask' }>;
  decide: ReturnType<typeof useCliPage>['decide'];
}): ReactElement {
  const { login, deciding, error } = screen;
  const busy = deciding !== undefined;
  return (
    <div aria-busy={busy}>
      <p className="fd-setup-text fd-cli-ask">{askLine(login)}</p>
      <p className="fd-cli-code" aria-label="Code">
        {login.userCode}
      </p>
      <div className="fd-cli-actions">
        <button
          type="button"
          className="fd-control fd-setup-submit fd-cli-connect"
          disabled={busy}
          onClick={() => {
            decide('approve');
          }}
        >
          {CONNECT}
        </button>
        <button
          type="button"
          className="fd-control fd-cli-cancel"
          disabled={busy}
          onClick={() => {
            decide('cancel');
          }}
        >
          {CANCEL}
        </button>
      </div>
      <p className="fd-setup-error fd-setup-form-error" role="alert">
        {error}
      </p>
    </div>
  );
}

function Body({ state }: { state: ReturnType<typeof useCliPage> }) {
  const { screen, read, decide } = state;
  switch (screen.name) {
    case 'loading':
      return null;
    case 'enter':
      return (
        <CodeForm
          error={screen.error}
          typed={screen.code}
          reading={screen.reading}
          onCode={read}
        />
      );
    case 'ask':
      return <Ask screen={screen} decide={decide} />;
    case 'connected':
      return (
        <p className="fd-setup-text fd-cli-done" role="status">
          {CONNECTED}
        </p>
      );
    case 'cancelled':
      return (
        <p className="fd-setup-text fd-cli-done" role="status">
          {CANCELLED}
        </p>
      );
  }
}

export function CliPage({
  code,
  readCliLogin,
  decideCliLogin,
}: CliPageProps): ReactElement | null {
  const state = useCliPage(code, readCliLogin, decideCliLogin);
  if (state.screen.name === 'loading') return null;
  return (
    <main className="fd-setup">
      <section className="fd-setup-card" aria-labelledby="fd-cli-title">
        <AuthBrand />
        <h1 id="fd-cli-title" className="fd-setup-title fd-auth-title">
          {CLI_TITLE}
        </h1>
        <Body state={state} />
      </section>
    </main>
  );
}

export interface CliRouteSources {
  readCliLogin?: ReadCliLogin | undefined;
  decideCliLogin?: DecideCliLogin | undefined;
}

function CliRoute({
  readCliLogin,
  decideCliLogin,
}: {
  readCliLogin: ReadCliLogin;
  decideCliLogin: DecideCliLogin;
}): ReactElement {
  const [params] = useSearchParams();
  const code = params.get('code') ?? undefined;
  return (
    <CliPage
      key={code ?? ''}
      code={code}
      readCliLogin={readCliLogin}
      decideCliLogin={decideCliLogin}
    />
  );
}

export function cliRoute({
  readCliLogin,
  decideCliLogin,
}: CliRouteSources): ReactElement | undefined {
  if (readCliLogin === undefined || decideCliLogin === undefined) {
    return undefined;
  }
  return (
    <Route
      path="cli"
      element={
        <CliRoute readCliLogin={readCliLogin} decideCliLogin={decideCliLogin} />
      }
    />
  );
}
