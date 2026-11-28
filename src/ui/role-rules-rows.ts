import type {
  RoleRuleField,
  SaveRoleRulesOutcome,
  StoredRoleRule,
} from './role-rules-api.ts';
import { noLongerThere } from './projects-view.ts';

export const SAVE_RULES = 'Save rules';
export const NO_RULE = 'No role rule: sub-agents take their type as role.';
export const LEAVE_QUESTION = 'Leave without saving the rules?';

export interface RuleRow {
  key: string;
  name: string;
  description: string;
  agentType: string;
}

export type RowErrors = Partial<Record<RoleRuleField, string>>;

export interface RuleErrors {
  rows: Record<string, RowErrors>;
  section?: string;
}

export type RuleControl = RoleRuleField | 'up' | 'down' | 'delete' | 'add';

export interface RuleFocus {
  index: number;
  control: RuleControl;
}

export function rowsOf(
  rules: readonly StoredRoleRule[],
  keyOf: (index: number) => string,
): RuleRow[] {
  return rules.map((rule, index) => ({
    key: keyOf(index),
    name: rule.name,
    description: rule.description ?? '',
    agentType: rule.agentType ?? '',
  }));
}

function patternOf(value: string): string | null {
  return value === '' ? null : value;
}

export function rulesOfRows(rows: readonly RuleRow[]): StoredRoleRule[] {
  return rows.map((row) => ({
    name: row.name,
    description: patternOf(row.description),
    agentType: patternOf(row.agentType),
  }));
}

export function sameRules(
  rows: readonly RuleRow[],
  rules: readonly StoredRoleRule[],
): boolean {
  const typed = rulesOfRows(rows);
  return (
    typed.length === rules.length &&
    typed.every((rule, index) => {
      const other = rules[index];
      return (
        other !== undefined &&
        rule.name === other.name &&
        rule.description === other.description &&
        rule.agentType === other.agentType
      );
    })
  );
}

export function movedRows(
  rows: readonly RuleRow[],
  index: number,
  by: -1 | 1,
): RuleRow[] {
  const target = index + by;
  const row = rows[index];
  const other = rows[target];
  if (row === undefined || other === undefined) return [...rows];
  const next = [...rows];
  next[index] = other;
  next[target] = row;
  return next;
}

export function movedFocus(
  index: number,
  by: -1 | 1,
  count: number,
): RuleFocus {
  const target = index + by;
  if (by === -1)
    return { index: target, control: target === 0 ? 'down' : 'up' };
  return { index: target, control: target === count - 1 ? 'up' : 'down' };
}

export function deletedFocus(index: number, count: number): RuleFocus {
  if (count <= 1) return { index: 0, control: 'add' };
  return { index: Math.min(index, count - 2), control: 'delete' };
}

export function errorsOf(
  outcome: Exclude<SaveRoleRulesOutcome, { status: 'saved' }>,
  sent: readonly RuleRow[],
  projectName: string,
): RuleErrors {
  if (outcome.status === 'missing') {
    return { rows: {}, section: noLongerThere(projectName) };
  }
  if (outcome.status === 'failed') {
    return { rows: {}, section: outcome.message };
  }
  const row =
    outcome.rule === undefined || outcome.field === 'rules'
      ? undefined
      : sent[outcome.rule];
  if (row === undefined || outcome.field === 'rules') {
    return { rows: {}, section: outcome.message };
  }
  return { rows: { [row.key]: { [outcome.field]: outcome.message } } };
}
