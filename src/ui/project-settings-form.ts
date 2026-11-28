import {
  type FormEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
import type {
  ListedProject,
  ProjectField,
  ProjectInput,
  SaveProject,
  SaveProjectOutcome,
} from './projects-api.ts';
import { noLongerThere } from './projects-view.ts';

export const SAVE = 'Save';
export const SAVING = 'Saving…';
export const SAVED = 'Saved';
export const SAVED_MS = 3000;

const FIELDS: readonly ProjectField[] = ['name', 'remote'];

export type Edits = Partial<ProjectInput>;

export type SettingsErrors = Partial<
  Record<ProjectField | 'form' | 'missing', string>
>;

export function changedFields(project: ListedProject, edits: Edits): Edits {
  const changes: Edits = {};
  for (const field of FIELDS) {
    const value = edits[field];
    if (value !== undefined && value !== project[field]) changes[field] = value;
  }
  return changes;
}

export function keptEdits(edits: Edits, sent: Edits): Edits {
  const kept: Edits = {};
  for (const field of FIELDS) {
    const value = edits[field];
    if (value !== undefined && value !== sent[field]) kept[field] = value;
  }
  return kept;
}

function errorsOf(
  outcome: Exclude<SaveProjectOutcome, { status: 'saved' }>,
  project: ListedProject,
): SettingsErrors {
  if (outcome.status === 'invalid') return { [outcome.field]: outcome.message };
  if (outcome.status === 'missing') {
    return { missing: noLongerThere(project.name) };
  }
  return { form: outcome.message };
}

function useSavedFlag(): [boolean, (shown: boolean) => void] {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!shown) return undefined;
    const timer = setTimeout(() => {
      setShown(false);
    }, SAVED_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [shown]);
  return [shown, setShown];
}

export interface SettingsForm {
  values: ProjectInput;
  changed: boolean;
  errors: SettingsErrors;
  saving: boolean;
  saved: boolean;
  change: (field: ProjectField, value: string) => void;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

export function useSettingsForm(
  project: ListedProject,
  saveProject: SaveProject,
  onSaved: (project: ListedProject) => void,
  inputs: Record<ProjectField, RefObject<HTMLInputElement | null>>,
): SettingsForm {
  const [edits, setEdits] = useState<Edits>({});
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useSavedFlag();
  const busy = useRef(false);
  const changes = changedFields(project, edits);
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy.current || Object.keys(changes).length === 0) return;
    busy.current = true;
    setSaving(true);
    setErrors({});
    setSaved(false);
    const outcome = await saveProject(project.id, changes);
    busy.current = false;
    setSaving(false);
    if (outcome.status === 'saved') {
      setEdits((previous) => keptEdits(previous, changes));
      onSaved(outcome.project);
      setSaved(true);
      return;
    }
    setErrors(errorsOf(outcome, project));
    if (outcome.status === 'invalid') inputs[outcome.field].current?.focus();
  }
  return {
    values: {
      name: edits.name ?? project.name,
      remote: edits.remote ?? project.remote,
    },
    changed: Object.keys(changes).length > 0,
    errors,
    saving,
    saved,
    change: (field, value) => {
      setEdits((previous) => ({ ...previous, [field]: value }));
      setSaved(false);
    },
    submit,
  };
}
