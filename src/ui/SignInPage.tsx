import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
  type RefObject,
} from 'react';
import type { Account, SignIn, SignInInput } from './auth-api.ts';
import { Logo } from './components/Logo.tsx';
import './components/controls.css';
import './components/layout.css';
import './shell.css';
import './setup-page.css';

export const SIGN_IN_TITLE = 'Sign in to FactoryDeck';
export const SIGN_IN = 'Sign in';
export const SIGNING_IN = 'Signing in…';

type Field = keyof SignInInput;

type FocusTarget = { target: Field | 'button' };

interface FieldSpec {
  field: Field;
  label: string;
  type: string;
  autoComplete: string;
}

const FIELDS: readonly FieldSpec[] = [
  { field: 'email', label: 'Email', type: 'email', autoComplete: 'username' },
  {
    field: 'password',
    label: 'Password',
    type: 'password',
    autoComplete: 'current-password',
  },
];

export function AuthBrand(): ReactElement {
  return (
    <span className="fd-brand">
      <Logo />
      <span>
        Factory<span className="fd-brand-accent">Deck</span>
      </span>
    </span>
  );
}

export interface SignInPageProps {
  signIn: SignIn;
  onSignedIn: (account: Account) => void;
}

function useSignInForm({ signIn, onSignedIn }: SignInPageProps): {
  values: SignInInput;
  error: string | undefined;
  sending: boolean;
  inputs: RefObject<Partial<Record<Field, HTMLInputElement | null>>>;
  button: RefObject<HTMLButtonElement | null>;
  change: (field: Field, value: string) => void;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
} {
  const [values, setValues] = useState<SignInInput>({
    email: '',
    password: '',
  });
  const [error, setError] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [focus, setFocus] = useState<FocusTarget>({ target: 'email' });
  const inputs = useRef<Partial<Record<Field, HTMLInputElement | null>>>({});
  const button = useRef<HTMLButtonElement | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (sending) return;
    if (focus.target === 'button') button.current?.focus();
    else inputs.current[focus.target]?.focus();
  }, [focus, sending]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setSending(true);
    setError(undefined);
    const outcome = await signIn(values);
    busy.current = false;
    if (outcome.status === 'signed-in') {
      onSignedIn(outcome.account);
      return;
    }
    setSending(false);
    setError(outcome.message);
    if (outcome.status === 'refused') {
      setValues((previous) => ({ ...previous, password: '' }));
      setFocus({ target: 'password' });
      return;
    }
    setFocus({ target: 'button' });
  }

  function change(field: Field, value: string): void {
    setValues((previous) => ({ ...previous, [field]: value }));
  }

  return { values, error, sending, inputs, button, change, submit };
}

export function SignInPage(props: SignInPageProps): ReactElement {
  const { values, error, sending, inputs, button, change, submit } =
    useSignInForm(props);
  return (
    <main className="fd-setup">
      <form
        className="fd-setup-card"
        aria-labelledby="fd-sign-in-title"
        aria-busy={sending}
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <AuthBrand />
        <h1 id="fd-sign-in-title" className="fd-setup-title fd-auth-title">
          {SIGN_IN_TITLE}
        </h1>
        {FIELDS.map(({ field, label, type, autoComplete }) => (
          <div key={field} className="fd-setup-field fd-auth-field">
            <label htmlFor={`fd-sign-in-${field}`}>{label}</label>
            <input
              ref={(element) => {
                inputs.current[field] = element;
              }}
              id={`fd-sign-in-${field}`}
              name={field}
              type={type}
              autoComplete={autoComplete}
              value={values[field]}
              onChange={(event) => change(field, event.currentTarget.value)}
            />
          </div>
        ))}
        <button
          ref={button}
          type="submit"
          className="fd-control fd-setup-submit"
          disabled={sending}
        >
          {sending ? SIGNING_IN : SIGN_IN}
        </button>
        <p className="fd-setup-error fd-setup-form-error" role="alert">
          {error}
        </p>
      </form>
    </main>
  );
}
