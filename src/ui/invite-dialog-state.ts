import {
  type FormEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
import { formatDateTime } from './format.ts';
import type {
  CreatedInvitation,
  InviteField,
  InviteInput,
  InviteOutcome,
} from './invitations-api.ts';

export const COPY_LINK = 'Copy link';
export const COPIED = 'Copied';
export const COPY_FAILED = 'Could not copy';
export const COPIED_MS = 2000;
export const FAILED_MS = 4000;

export type InviteErrors = Partial<Record<InviteField | 'form', string>>;

export interface InviteForm {
  values: InviteInput;
  change: (values: Partial<InviteInput>) => void;
  errors: InviteErrors;
  sending: boolean;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

export function useInviteForm(
  invite: (input: InviteInput) => Promise<InviteOutcome>,
  onCreated: (invitation: CreatedInvitation) => void,
  fields: {
    email: RefObject<HTMLInputElement | null>;
    role: RefObject<HTMLSelectElement | null>;
  },
): InviteForm {
  const [values, setValues] = useState<InviteInput>({
    email: '',
    role: 'dev',
  });
  const [errors, setErrors] = useState<InviteErrors>({});
  const [sending, setSending] = useState(false);
  const busy = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setSending(true);
    setErrors({});
    const outcome = await invite(values);
    busy.current = false;
    setSending(false);
    if (outcome.status === 'created') {
      onCreated(outcome.invitation);
      return;
    }
    if (outcome.status === 'invalid') {
      setErrors({ [outcome.field]: outcome.message });
      fields[outcome.field].current?.focus();
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

export type CopyState = 'idle' | 'copied' | 'failed';

export const COPY_LABELS: Readonly<Record<CopyState, string>> = {
  idle: COPY_LINK,
  copied: COPIED,
  failed: COPY_FAILED,
};

export function useCopyState(): [CopyState, (state: CopyState) => void] {
  const [state, setState] = useState<CopyState>('idle');
  useEffect(() => {
    if (state === 'idle') return undefined;
    const timer = setTimeout(
      () => {
        setState('idle');
      },
      state === 'copied' ? COPIED_MS : FAILED_MS,
    );
    return () => {
      clearTimeout(timer);
    };
  }, [state]);
  return [state, setState];
}

export function linkText(invitation: CreatedInvitation): string {
  return `Send this link to ${invitation.email}. It works once, until ${formatDateTime(invitation.expiresAt)}, and is shown only now: if it is lost, make a new one.`;
}

export function errorProps(
  id: string,
  error: string | undefined,
): { 'aria-invalid': boolean; 'aria-describedby': string | undefined } {
  return {
    'aria-invalid': error !== undefined,
    'aria-describedby': error === undefined ? undefined : `${id}-error`,
  };
}
