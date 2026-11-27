import {
  type FormEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type {
  AcceptField,
  AcceptInvitation,
  InvitationRead,
  ReadInvitation,
} from './invitations-api.ts';

type Values = Record<AcceptField, string>;
type Errors = Partial<Record<AcceptField | 'form', string>>;

export interface AcceptForm {
  values: Values;
  errors: Errors;
  sending: boolean;
  inputs: RefObject<Partial<Record<AcceptField, HTMLInputElement | null>>>;
  button: RefObject<HTMLButtonElement | null>;
  change: (field: AcceptField, value: string) => void;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

const INVITE_PATH = /^\/invite\/([^/]+)\/?$/;

export function inviteToken(pathname: string): string | undefined {
  const token = INVITE_PATH.exec(pathname)?.[1];
  if (token === undefined) return undefined;
  try {
    return decodeURIComponent(token);
  } catch {
    return token;
  }
}

export function useAcceptForm(
  token: string,
  acceptInvitation: AcceptInvitation,
  onCreated: () => void,
  onDead: () => void,
): AcceptForm {
  const [values, setValues] = useState<Values>({ name: '', password: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [focus, setFocus] = useState<{ target: AcceptField | 'button' }>({
    target: 'name',
  });
  const inputs = useRef<Partial<Record<AcceptField, HTMLInputElement | null>>>(
    {},
  );
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
    setErrors({});
    const outcome = await acceptInvitation({ token, ...values });
    busy.current = false;
    if (outcome.status === 'created') {
      onCreated();
      return;
    }
    setSending(false);
    if (outcome.status === 'dead') {
      onDead();
      return;
    }
    if (outcome.status === 'invalid') {
      setErrors({ [outcome.field]: outcome.message });
      setFocus({ target: outcome.field });
      return;
    }
    setErrors({ form: outcome.message });
    setFocus({ target: 'button' });
  }

  function change(field: AcceptField, value: string): void {
    setValues((previous) => ({ ...previous, [field]: value }));
  }

  return { values, errors, sending, inputs, button, change, submit };
}

export function useInvitationRead(
  token: string,
  readInvitation: ReadInvitation,
): [InvitationRead | undefined, boolean, () => void, () => void] {
  const [read, setRead] = useState<InvitationRead>();
  const [retrying, setRetrying] = useState(false);
  const current = useRef(true);
  const load = useCallback(() => {
    void readInvitation(token).then((result) => {
      if (!current.current) return;
      setRead(result);
      setRetrying(false);
    });
  }, [readInvitation, token]);
  useEffect(() => {
    current.current = true;
    load();
    return () => {
      current.current = false;
    };
  }, [load]);
  return [
    read,
    retrying,
    () => {
      setRetrying(true);
      load();
    },
    () => {
      setRead({ status: 'dead' });
    },
  ];
}
