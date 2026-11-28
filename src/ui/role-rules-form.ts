import { type FormEvent, useRef, useState } from 'react';
import { DEFAULT_ROLE_RULES } from '../roles/default-roles.ts';
import type { ListedProject } from './projects-api.ts';
import { useSavedFlag } from './project-settings-form.ts';
import type {
  LoadRoleRules,
  RoleRuleField,
  RoleRulesView,
  SaveRoleRules,
  StoredRoleRule,
} from './role-rules-api.ts';
import {
  type RuleErrors,
  type RuleFocus,
  type RuleRow,
  deletedFocus,
  errorsOf,
  movedFocus,
  movedRows,
  rowsOf,
  rulesOfRows,
  sameRules,
} from './role-rules-rows.ts';
import { useRefreshing } from './skills-api.ts';

export {
  LEAVE_QUESTION,
  NO_RULE,
  SAVE_RULES,
  type RowErrors,
  type RuleFocus,
  type RuleRow,
} from './role-rules-rows.ts';
function useLastRules(
  view: RoleRulesView | undefined,
): StoredRoleRule[] | undefined {
  const [last, setLast] = useState<StoredRoleRule[]>();
  if (view?.status === 'ok' && view.rules !== last) setLast(view.rules);
  return view?.status === 'ok' ? view.rules : last;
}

function useRulesView(project: ListedProject, loadRules: LoadRoleRules) {
  const [version, setVersion] = useState(0);
  const view = useRefreshing(
    `role-rules:${String(project.id)}:${String(version)}`,
    () => loadRules(project.id),
    `role-rules:${String(project.id)}`,
  );
  const [answered, setAnswered] = useState<{
    from: RoleRulesView | undefined;
    rules: StoredRoleRule[];
  }>();
  const last = useLastRules(view);
  const rules =
    answered !== undefined && answered.from === view ? answered.rules : last;
  const onSaved = (saved: StoredRoleRule[]): void => {
    setAnswered({ from: view, rules: saved });
    setVersion((previous) => previous + 1);
  };
  return { view, rules, onSaved };
}

type RuleActions = Pick<
  RoleRulesForm,
  'change' | 'add' | 'move' | 'remove' | 'reset'
>;

function ruleActions(
  rows: readonly RuleRow[],
  edit: (next: RuleRow[], focus?: RuleFocus) => void,
  newKey: () => string,
): RuleActions {
  return {
    change: (index, field, value) => {
      edit(
        rows.map((row, at) =>
          at === index ? { ...row, [field]: value } : row,
        ),
      );
    },
    add: () => {
      edit(
        [...rows, { key: newKey(), name: '', description: '', agentType: '' }],
        { index: rows.length, control: 'name' },
      );
    },
    move: (index, by) => {
      edit(movedRows(rows, index, by), movedFocus(index, by, rows.length));
    },
    remove: (index) => {
      edit(
        rows.filter((_, at) => at !== index),
        deletedFocus(index, rows.length),
      );
    },
    reset: () => {
      edit(rowsOf(DEFAULT_ROLE_RULES, newKey));
    },
  };
}

interface SubmitSources {
  project: ListedProject;
  saveRules: SaveRoleRules;
  edits: RuleRow[] | undefined;
  changed: boolean;
  setEdits: (
    update: (previous: RuleRow[] | undefined) => RuleRow[] | undefined,
  ) => void;
  onSaved: (rules: StoredRoleRule[]) => void;
  setSaved: (shown: boolean) => void;
  setFocus: (focus: RuleFocus) => void;
}

function useRulesSubmit(sources: SubmitSources) {
  const { project, saveRules, edits, changed, setEdits, onSaved, setSaved } =
    sources;
  const [errors, setErrors] = useState<RuleErrors>({ rows: {} });
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy.current || !changed || edits === undefined) return;
    const sent = edits;
    busy.current = true;
    setSaving(true);
    setErrors({ rows: {} });
    setSaved(false);
    const outcome = await saveRules(project.id, rulesOfRows(sent));
    busy.current = false;
    setSaving(false);
    if (outcome.status === 'saved') {
      setEdits((previous) => (previous === sent ? undefined : previous));
      onSaved(outcome.rules);
      setSaved(true);
      return;
    }
    setErrors(errorsOf(outcome, sent, project.name));
    if (outcome.status === 'invalid' && outcome.field !== 'rules') {
      sources.setFocus({ index: outcome.rule ?? 0, control: outcome.field });
    }
  }
  return { errors, saving, submit };
}

export interface RoleRulesForm {
  view: RoleRulesView | undefined;
  rows: RuleRow[] | undefined;
  changed: boolean;
  errors: RuleErrors;
  saving: boolean;
  saved: boolean;
  focus: RuleFocus | undefined;
  change: (index: number, field: RoleRuleField, value: string) => void;
  add: () => void;
  move: (index: number, by: -1 | 1) => void;
  remove: (index: number) => void;
  reset: () => void;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

export function useRoleRulesForm(
  project: ListedProject,
  loadRules: LoadRoleRules,
  saveRules: SaveRoleRules,
): RoleRulesForm {
  const { view, rules, onSaved } = useRulesView(project, loadRules);
  const [edits, setEdits] = useState<RuleRow[]>();
  const [saved, setSaved] = useSavedFlag();
  const [focus, setFocus] = useState<RuleFocus>();
  const fresh = useRef(0);
  const newKey = (): string => {
    fresh.current += 1;
    return `new-${String(fresh.current)}`;
  };
  const shown =
    edits ??
    (rules === undefined ? undefined : rowsOf(rules, (i) => `s${String(i)}`));
  const changed =
    edits !== undefined && (rules === undefined || !sameRules(edits, rules));
  const edit = (next: RuleRow[], nextFocus?: RuleFocus): void => {
    setEdits(rules !== undefined && sameRules(next, rules) ? undefined : next);
    setFocus(nextFocus);
    setSaved(false);
  };
  const { errors, saving, submit } = useRulesSubmit({
    project,
    saveRules,
    edits,
    changed,
    setEdits,
    onSaved,
    setSaved,
    setFocus,
  });
  return {
    view,
    rows: shown,
    changed,
    errors,
    saving,
    saved,
    focus,
    ...ruleActions(shown ?? [], edit, newKey),
    submit,
  };
}
