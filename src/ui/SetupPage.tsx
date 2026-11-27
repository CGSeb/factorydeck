import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
  type RefObject,
} from 'react';
import type { SetupField, SetupInput, SetupManager } from './auth-api.ts';
import { Logo } from './components/Logo.tsx';
import './components/controls.css';
import './components/layout.css';
import './shell.css';
import './setup-page.css';

export const SETUP_TITLE = 'Set up FactoryDeck';
export const SETUP_TEXT =
  'Enter the setup code from the server log, then create the first manager account.';
export const CREATE = 'Create manager account';
export const CREATING = 'Creating…';
export const PASSWORD_HINT = 'At least 12 characters';

interface FieldSpec {
  field: SetupField;
  label: string;
  type: string;
  autoComplete: string;
  hint?: string;
}

const FIELDS: readonly FieldSpec[] = [
  { field: 'code', label: 'Setup code', type: 'text', autoComplete: 'off' },
  { field: 'name', label: 'Name', type: 'text', autoComplete: 'name' },
  { field: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  {
    field: 'password',
    label: 'Password',
    type: 'password',
    autoComplete: 'new-password',
    hint: PASSWORD_HINT,
  },
];

const EMPTY: SetupInput = { code: '', email: '', name: '', password: '' };

type Errors = Partial<Record<SetupField | 'form', string>>;

interface FieldRowProps {
  spec: FieldSpec;
  value: string;
  error: string | undefined;
  inputRef: (element: HTMLInputElement | null) => void;
  onChange: (value: string) => void;
}

function FieldRow({
  spec: { field, label, type, autoComplete, hint },
  value,
  error,
  inputRef,
  onChange,
}: FieldRowProps): ReactElement {
  const id = `fd-setup-${field}`;
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
        spellCheck={field === 'code' ? false : undefined}
        autoCapitalize={field === 'code' ? 'characters' : undefined}
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

interface SetupForm {
  values: SetupInput;
  errors: Errors;
  sending: boolean;
  inputs: RefObject<Partial<Record<SetupField, HTMLInputElement | null>>>;
  button: RefObject<HTMLButtonElement | null>;
  change: (field: SetupField, value: string) => void;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

function useSetupForm(
  setupManager: SetupManager,
  onCreated: () => void,
): SetupForm {
  const [values, setValues] = useState<SetupInput>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const inputs = useRef<Partial<Record<SetupField, HTMLInputElement | null>>>(
    {},
  );
  const button = useRef<HTMLButtonElement | null>(null);
  const busy = useRef(false);
  const [focusTarget, setFocusTarget] = useState<SetupField | 'form'>('code');

  useEffect(() => {
    if (sending) return;
    if (focusTarget !== 'form') {
      inputs.current[focusTarget]?.focus();
      return;
    }
    const active = document.activeElement;
    if (
      active === null ||
      active === document.body ||
      active === button.current
    ) {
      button.current?.focus();
    }
  }, [errors, focusTarget, sending]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setSending(true);
    setErrors({});
    const outcome = await setupManager(values);
    busy.current = false;
    setSending(false);
    if (outcome.status === 'created') {
      onCreated();
      return;
    }
    if (outcome.status === 'invalid') {
      setErrors({ [outcome.field]: outcome.message });
      setFocusTarget(outcome.field);
      return;
    }
    setErrors({ form: outcome.message });
    setFocusTarget('form');
  }

  function change(field: SetupField, value: string): void {
    setValues((previous) => ({ ...previous, [field]: value }));
  }

  return { values, errors, sending, inputs, button, change, submit };
}

export interface SetupPageProps {
  setupManager: SetupManager;
  onCreated: () => void;
}

export function SetupPage({
  setupManager,
  onCreated,
}: SetupPageProps): ReactElement {
  const { values, errors, sending, inputs, button, change, submit } =
    useSetupForm(setupManager, onCreated);
  return (
    <main className="fd-setup">
      <form
        className="fd-setup-card"
        aria-labelledby="fd-setup-title"
        aria-busy={sending}
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <span className="fd-brand">
          <Logo />
          <span>
            Factory<span className="fd-brand-accent">Deck</span>
          </span>
        </span>
        <h1 id="fd-setup-title" className="fd-setup-title">
          {SETUP_TITLE}
        </h1>
        <p className="fd-setup-text">{SETUP_TEXT}</p>
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
          {sending ? CREATING : CREATE}
        </button>
        <p className="fd-setup-error fd-setup-form-error" role="alert">
          {errors.form}
        </p>
      </form>
    </main>
  );
}
