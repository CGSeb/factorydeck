import {
  type FormEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
import { CHOOSE_GIT_HOST } from '../team/git-host-kind.ts';
import type {
  GitHostField,
  GitHostKind,
  RemoveToken,
  SaveToken,
  SaveTokenOutcome,
  TokenInput,
} from './git-host-token-api.ts';
import { checkedMessage, readOnlyHost } from './git-host-view.ts';
import type { ListedProject } from './projects-api.ts';
import { noLongerThere } from './projects-view.ts';

export type HostChoice = GitHostKind | '';

export type GitHostErrors = Partial<Record<GitHostField | 'form', string>>;

export type TokenRemoval =
  { state: 'idle' | 'removing' } | { state: 'failed'; message: string };

export interface GitHostInputs {
  token: RefObject<HTMLInputElement | null>;
  gitHost: RefObject<HTMLSelectElement | null>;
}

export interface GitHostForm {
  readOnly: GitHostKind | undefined;
  token: string;
  host: HostChoice;
  changed: boolean;
  keyMissing: boolean;
  canSave: boolean;
  canRemove: boolean;
  checking: boolean;
  checked: string | undefined;
  errors: GitHostErrors;
  removal: TokenRemoval | undefined;
  changeToken: (value: string) => void;
  changeHost: (value: HostChoice) => void;
  save: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  openRemoval: () => void;
  closeRemoval: () => void;
  confirmRemoval: () => Promise<void>;
}

export interface GitHostSources {
  saveToken: SaveToken;
  removeToken: RemoveToken;
}

export function hostChoice(value: string): HostChoice {
  return value === 'github' || value === 'gitlab' ? value : '';
}

function errorsOf(
  outcome: Extract<
    SaveTokenOutcome,
    { status: 'invalid' | 'missing' | 'failed' }
  >,
  project: ListedProject,
): GitHostErrors {
  if (outcome.status === 'invalid') return { [outcome.field]: outcome.message };
  if (outcome.status === 'missing')
    return { form: noLongerThere(project.name) };
  return { form: outcome.message };
}

function withoutToken(project: ListedProject): ListedProject {
  return { ...project, tokenSet: false, tokenSetAt: null, tokenSetBy: null };
}

function useFocusRequest(
  target: RefObject<HTMLInputElement | null>,
): () => void {
  const [request, setRequest] = useState(0);
  useEffect(() => {
    if (request > 0) target.current?.focus();
  }, [request, target]);
  return () => {
    setRequest((previous) => previous + 1);
  };
}

function useRemoval(
  project: ListedProject,
  removeToken: RemoveToken,
  onSaved: (project: ListedProject) => void,
  focusToken: () => void,
) {
  const [removal, setRemoval] = useState<TokenRemoval>();
  async function confirmRemoval(): Promise<void> {
    if (removal?.state === 'removing') return;
    setRemoval({ state: 'removing' });
    const outcome = await removeToken(project.id);
    if (outcome.status === 'removed') {
      setRemoval(undefined);
      onSaved(withoutToken(project));
      focusToken();
      return;
    }
    setRemoval({
      state: 'failed',
      message:
        outcome.status === 'missing'
          ? noLongerThere(project.name)
          : outcome.message,
    });
  }
  return {
    removal,
    openRemoval: () => {
      setRemoval({ state: 'idle' });
    },
    closeRemoval: () => {
      setRemoval(undefined);
    },
    confirmRemoval,
  };
}

export interface GitHostFormOptions {
  project: ListedProject;
  secretKey: boolean;
  sources: GitHostSources;
  onSaved: (project: ListedProject) => void;
  inputs: GitHostInputs;
}

interface TokenEdits {
  token: string;
  host: HostChoice;
  readOnly: GitHostKind | undefined;
  hostChanged: boolean;
  checked: string | undefined;
  setChecked: (checked: string | undefined) => void;
  changeToken: (value: string) => void;
  changeHost: (value: HostChoice) => void;
  clearSent: (sent: { token: string; host: HostChoice }) => void;
}

function useTokenEdits(project: ListedProject): TokenEdits {
  const [token, setToken] = useState('');
  const [hostEdit, setHostEdit] = useState<HostChoice>();
  const [checked, setChecked] = useState<string>();
  const readOnly = readOnlyHost(project.remote);
  const stored: HostChoice = project.gitHost ?? '';
  const host = hostEdit ?? stored;
  return {
    token,
    host,
    readOnly,
    hostChanged: readOnly === undefined && host !== stored,
    checked,
    setChecked,
    changeToken: (value) => {
      setToken(value);
      setChecked(undefined);
    },
    changeHost: (value) => {
      setHostEdit(value);
      setChecked(undefined);
    },
    clearSent: (sent) => {
      setToken((current) => (current === sent.token ? '' : current));
      setHostEdit((current) => (current === sent.host ? undefined : current));
    },
  };
}

function tokenInput(edits: TokenEdits): TokenInput {
  const { token, host, readOnly } = edits;
  return {
    token: token.trim(),
    ...(readOnly === undefined && host !== '' ? { gitHost: host } : {}),
  };
}

function useTokenSave(
  { project, sources, onSaved, inputs }: GitHostFormOptions,
  edits: TokenEdits,
) {
  const [errors, setErrors] = useState<GitHostErrors>({});
  const [checking, setChecking] = useState(false);
  const [noKeyFor, setNoKeyFor] = useState<ListedProject>();
  const busy = useRef(false);
  function settle(outcome: SaveTokenOutcome, sent: TokenEdits): void {
    if (outcome.status === 'saved') {
      edits.clearSent(sent);
      onSaved({ ...project, ...outcome.token });
      edits.setChecked(checkedMessage(outcome.defaultBranch));
      return;
    }
    if (outcome.status === 'no-key') {
      setNoKeyFor(project);
      return;
    }
    setErrors(errorsOf(outcome, project));
    if (outcome.status === 'invalid') inputs[outcome.field].current?.focus();
  }
  async function send(): Promise<void> {
    if (edits.readOnly === undefined && edits.host === '') {
      setErrors({ gitHost: CHOOSE_GIT_HOST });
      edits.setChecked(undefined);
      inputs.gitHost.current?.focus();
      return;
    }
    busy.current = true;
    setChecking(true);
    setErrors({});
    edits.setChecked(undefined);
    const outcome = await sources.saveToken(project.id, tokenInput(edits));
    busy.current = false;
    setChecking(false);
    settle(outcome, edits);
  }
  return { errors, checking, noKeyFor, busy, send };
}

export function useGitHostForm(options: GitHostFormOptions): GitHostForm {
  const { project, secretKey, sources, onSaved, inputs } = options;
  const edits = useTokenEdits(project);
  const saving = useTokenSave(options, edits);
  const focusToken = useFocusRequest(inputs.token);
  const removal = useRemoval(project, sources.removeToken, onSaved, () => {
    edits.setChecked(undefined);
    focusToken();
  });
  const keyMissing = !secretKey || saving.noKeyFor === project;
  const canSave = edits.token.trim() !== '' && !saving.checking && !keyMissing;
  return {
    readOnly: edits.readOnly,
    token: edits.token,
    host: edits.host,
    changed: edits.token !== '' || edits.hostChanged,
    keyMissing,
    canSave,
    canRemove: project.tokenSet && !saving.checking,
    checking: saving.checking,
    checked: edits.checked,
    errors: saving.errors,
    ...removal,
    changeToken: edits.changeToken,
    changeHost: edits.changeHost,
    save: async (event) => {
      event.preventDefault();
      if (saving.busy.current || !canSave) return;
      await saving.send();
    },
  };
}
