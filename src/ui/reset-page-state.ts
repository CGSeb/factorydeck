import {
  type FormEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { Account, LoadMe } from './auth-api.ts';
import { type ReadReset, type SaveReset, isResetToken } from './reset-api.ts';

export type Screen =
  | { name: 'loading' }
  | { name: 'gone' }
  | { name: 'unreachable'; message: string; retrying: boolean }
  | { name: 'form'; email: string; signedInAs: string | undefined };

export interface ResetPageProps {
  token: string | undefined;
  readReset: ReadReset;
  saveReset: SaveReset;
  loadMe?: LoadMe | undefined;
  onSaved: (account: Account) => void;
}

async function signedInName(loadMe: LoadMe | undefined) {
  if (loadMe === undefined) return undefined;
  const me = await loadMe();
  return me.status === 'account' ? me.account.name : undefined;
}

export async function screenOf(
  token: string,
  readReset: ReadReset,
  loadMe: LoadMe | undefined,
): Promise<Screen> {
  const [read, name] = await Promise.all([
    readReset(token),
    signedInName(loadMe),
  ]);
  switch (read.status) {
    case 'ok':
      return { name: 'form', email: read.email, signedInAs: name };
    case 'gone':
      return { name: 'gone' };
    case 'unreachable':
      return { name: 'unreachable', message: read.message, retrying: false };
  }
}

export function useResetScreen(
  token: string | undefined,
  readReset: ReadReset,
  loadMe: LoadMe | undefined,
): [Screen, () => void, () => void] {
  const valid = isResetToken(token);
  const [screen, setScreen] = useState<Screen>(
    valid ? { name: 'loading' } : { name: 'gone' },
  );
  const current = useRef(true);
  const load = useCallback(() => {
    if (token === undefined || !isResetToken(token)) return;
    void screenOf(token, readReset, loadMe).then((loaded) => {
      if (current.current) setScreen(loaded);
    });
  }, [token, readReset, loadMe]);
  useEffect(() => {
    current.current = true;
    load();
    return () => {
      current.current = false;
    };
  }, [load]);
  function retry(): void {
    setScreen((previous) =>
      previous.name === 'unreachable'
        ? { ...previous, retrying: true }
        : previous,
    );
    load();
  }
  return [
    screen,
    retry,
    () => {
      setScreen({ name: 'gone' });
    },
  ];
}

export interface ResetFormProps {
  token: string;
  email: string;
  signedInAs: string | undefined;
  saveReset: SaveReset;
  onSaved: (account: Account) => void;
  onGone: () => void;
}

export interface ResetFormState {
  password: string;
  setPassword: (password: string) => void;
  error: string | undefined;
  invalid: boolean;
  sending: boolean;
  input: RefObject<HTMLInputElement | null>;
  button: RefObject<HTMLButtonElement | null>;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

export function useResetForm({
  token,
  saveReset,
  onSaved,
  onGone,
}: ResetFormProps): ResetFormState {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [invalid, setInvalid] = useState(false);
  const [sending, setSending] = useState(false);
  const [focus, setFocus] = useState<{ target: 'field' | 'button' }>({
    target: 'field',
  });
  const input = useRef<HTMLInputElement | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);
  const busy = useRef(false);
  useEffect(() => {
    if (sending) return;
    if (focus.target === 'button') button.current?.focus();
    else input.current?.focus();
  }, [focus, sending]);
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setSending(true);
    setError(undefined);
    setInvalid(false);
    const outcome = await saveReset(token, password);
    busy.current = false;
    if (outcome.status === 'saved') {
      onSaved(outcome.account);
      return;
    }
    if (outcome.status === 'gone') {
      onGone();
      return;
    }
    setSending(false);
    setError(outcome.message);
    setInvalid(outcome.status === 'invalid');
    setFocus({ target: outcome.status === 'invalid' ? 'field' : 'button' });
  }
  return {
    password,
    setPassword,
    error,
    invalid,
    sending,
    input,
    button,
    submit,
  };
}
