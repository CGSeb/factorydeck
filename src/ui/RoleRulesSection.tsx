import { type ReactElement, useId } from 'react';
import { Dialog } from './components/Dialog.tsx';
import { Panel } from './components/Panel.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { errorProps } from './invite-dialog-state.ts';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import { SAVED, SAVING } from './project-settings-form.ts';
import type { ListedProject } from './projects-api.ts';
import { noLongerThere } from './projects-view.ts';
import type {
  LoadRoleRules,
  RoleRuleField,
  SaveRoleRules,
} from './role-rules-api.ts';
import {
  LEAVE_QUESTION,
  NO_RULE,
  type RoleRulesForm,
  type RowErrors,
  type RuleRow,
  SAVE_RULES,
  useRoleRulesForm,
} from './role-rules-form.ts';
import { useFocusTarget, useLeaveGuard } from './role-rules-dom.ts';
import './components/controls.css';
import './setup-page.css';
import './projects.css';

export interface RoleRulesSectionProps {
  project: ListedProject;
  loadRoleRules: LoadRoleRules;
  saveRoleRules: SaveRoleRules;
}

const LOADING = 'Loading…';

const COLUMNS: readonly { field: RoleRuleField; label: string }[] = [
  { field: 'name', label: 'Name' },
  { field: 'description', label: 'Description pattern' },
  { field: 'agentType', label: 'Agent type pattern' },
];

const MOVES: readonly {
  by: -1 | 1;
  control: 'up' | 'down';
  label: string;
  glyph: string;
}[] = [
  { by: -1, control: 'up', label: 'up', glyph: '↑' },
  { by: 1, control: 'down', label: 'down', glyph: '↓' },
];

function LeavePrompt({ changed }: { changed: boolean }): ReactElement | null {
  const blocker = useLeaveGuard(changed);
  if (blocker.state !== 'blocked') return null;
  return (
    <Dialog
      title={LEAVE_QUESTION}
      text="Your changes to the role rules are lost."
      cancelLabel="Stay"
      onCancel={() => {
        blocker.reset?.();
      }}
      danger={{ label: 'Leave', onClick: () => blocker.proceed?.() }}
    />
  );
}

function PatternCell({
  id,
  field,
  label,
  value,
  error,
  onChange,
}: {
  id: string;
  field: RoleRuleField;
  label: string;
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
}): ReactElement {
  return (
    <td className="fd-rule-cell">
      <input
        id={id}
        className="fd-rule-input"
        data-control={field}
        data-pattern={field === 'name' ? undefined : 'true'}
        type="text"
        autoComplete="off"
        spellCheck={false}
        aria-label={label}
        value={value}
        {...errorProps(id, error)}
        onChange={(event) => {
          onChange(event.currentTarget.value);
        }}
      />
      <p id={`${id}-error`} className="fd-setup-error" role="alert">
        {error}
      </p>
    </td>
  );
}

function RuleButtons({
  index,
  count,
  form,
}: {
  index: number;
  count: number;
  form: RoleRulesForm;
}): ReactElement {
  return (
    <td className="fd-rule-actions">
      <div className="fd-rule-buttons">
        {MOVES.map(({ by, control, label, glyph }) => (
          <button
            key={control}
            type="button"
            className="fd-control fd-rule-button"
            data-control={control}
            aria-label={`Move rule ${String(index + 1)} ${label}`}
            title={`Move ${label}`}
            disabled={by === -1 ? index === 0 : index === count - 1}
            onClick={() => {
              form.move(index, by);
            }}
          >
            {glyph}
          </button>
        ))}
        <button
          type="button"
          className="fd-control fd-rule-button"
          data-control="delete"
          aria-label={`Delete rule ${String(index + 1)}`}
          onClick={() => {
            form.remove(index);
          }}
        >
          Delete
        </button>
      </div>
    </td>
  );
}

function RuleRowView({
  row,
  index,
  count,
  errors,
  form,
}: {
  row: RuleRow;
  index: number;
  count: number;
  errors: RowErrors | undefined;
  form: RoleRulesForm;
}): ReactElement {
  const id = useId();
  return (
    <tr>
      {COLUMNS.map(({ field, label }) => (
        <PatternCell
          key={field}
          id={`${id}-${field}`}
          field={field}
          label={`${label} of rule ${String(index + 1)}`}
          value={row[field]}
          error={errors?.[field]}
          onChange={(value) => {
            form.change(index, field, value);
          }}
        />
      ))}
      <RuleButtons index={index} count={count} form={form} />
    </tr>
  );
}

function RulesTable({
  rows,
  form,
}: {
  rows: RuleRow[];
  form: RoleRulesForm;
}): ReactElement {
  if (rows.length === 0) return <StatusLine>{NO_RULE}</StatusLine>;
  return (
    <div className="fd-table-scroll">
      <table className="fd-rules-table">
        <thead>
          <tr>
            {COLUMNS.map(({ field, label }) => (
              <th key={field} scope="col">
                {label}
              </th>
            ))}
            <th scope="col">
              <span className="fd-visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <RuleRowView
              key={row.key}
              row={row}
              index={index}
              count={rows.length}
              errors={form.errors.rows[row.key]}
              form={form}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RulesForm({
  rows,
  form,
}: {
  rows: RuleRow[];
  form: RoleRulesForm;
}): ReactElement {
  const target = useFocusTarget(form.focus);
  return (
    <form
      ref={target}
      className="fd-rules-form"
      noValidate
      aria-busy={form.saving}
      onSubmit={(event) => void form.submit(event)}
    >
      <RulesTable rows={rows} form={form} />
      <div className="fd-rules-edit">
        <button
          type="button"
          className="fd-control fd-dialog-button"
          data-control="add"
          onClick={form.add}
        >
          Add rule
        </button>
        <button
          type="button"
          className="fd-control fd-dialog-button"
          onClick={form.reset}
        >
          Reset to defaults
        </button>
      </div>
      <p className="fd-setup-error" role="alert">
        {form.errors.section}
      </p>
      <div className="fd-project-settings-actions">
        <button
          type="submit"
          className="fd-control fd-dialog-button"
          data-primary="true"
          disabled={form.saving || !form.changed}
        >
          {form.saving ? SAVING : SAVE_RULES}
        </button>
        <span className="fd-project-settings-saved" role="status">
          {form.saved ? SAVED : ''}
        </span>
      </div>
    </form>
  );
}

function SectionBody({
  project,
  form,
}: {
  project: ListedProject;
  form: RoleRulesForm;
}): ReactElement {
  if (form.rows !== undefined && (form.changed || form.view?.status === 'ok')) {
    return <RulesForm rows={form.rows} form={form} />;
  }
  if (form.view?.status === 'unreachable') {
    return <StatusLine>{UNREACHABLE_MESSAGE}</StatusLine>;
  }
  if (form.view?.status === 'missing') {
    return <StatusLine>{noLongerThere(project.name)}</StatusLine>;
  }
  return <StatusLine>{LOADING}</StatusLine>;
}

export function RoleRulesSection({
  project,
  loadRoleRules,
  saveRoleRules,
}: RoleRulesSectionProps): ReactElement {
  const form = useRoleRulesForm(project, loadRoleRules, saveRoleRules);
  return (
    <Panel heading="Role rules">
      <SectionBody project={project} form={form} />
      <LeavePrompt changed={form.changed} />
    </Panel>
  );
}
