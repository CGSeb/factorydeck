import { MAIN_ROLE, UNASSIGNED_ROLE } from './config.ts';
import type { StoredRoleRule } from './default-roles.ts';

export const MAX_RULES = 50;
export const MAX_PATTERN_LENGTH = 500;
export const MAX_ROLE_NAME_LENGTH = 40;

export const RULES_REQUIRED = 'Give a list of rules';
export const TOO_MANY_RULES = `At most ${String(MAX_RULES)} rules`;
export const ROLE_NAME_REQUIRED = 'Name is required';
export const ROLE_NAME_RESERVED = `${MAIN_ROLE} and ${UNASSIGNED_ROLE} are reserved`;
export const ROLE_NAME_FORMAT =
  'Use lower-case letters, digits and -, starting with a letter';
export const ROLE_NAME_LENGTH = `At most ${String(MAX_ROLE_NAME_LENGTH)} characters`;
export const PATTERN_REQUIRED = 'Give a description or an agent type pattern';
export const PATTERN_LENGTH = `At most ${String(MAX_PATTERN_LENGTH)} characters`;
export const PATTERN_TYPE = 'Not a valid regular expression: not text';

export type RoleRuleField = 'name' | 'description' | 'agentType';

export interface RoleRulesError {
  error: string;
  field: 'rules' | RoleRuleField;
  rule?: number;
}

export type RoleRuleFields =
  { ok: true; rules: StoredRoleRule[] } | ({ ok: false } & RoleRulesError);

type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nameOf(value: unknown): Checked<string> {
  const name = typeof value === 'string' ? value.trim() : '';
  if (name === '') return { ok: false, error: ROLE_NAME_REQUIRED };
  if (name.length > MAX_ROLE_NAME_LENGTH) {
    return { ok: false, error: ROLE_NAME_LENGTH };
  }
  if (name === MAIN_ROLE || name === UNASSIGNED_ROLE) {
    return { ok: false, error: ROLE_NAME_RESERVED };
  }
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    return { ok: false, error: ROLE_NAME_FORMAT };
  }
  return { ok: true, value: name };
}

function compileProblem(pattern: string): string | undefined {
  try {
    new RegExp(pattern, 'i');
    return undefined;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return `Not a valid regular expression: ${reason}`;
  }
}

function patternOf(value: unknown): Checked<string | null> {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: null };
  }
  if (typeof value !== 'string') return { ok: false, error: PATTERN_TYPE };
  if (value.length > MAX_PATTERN_LENGTH) {
    return { ok: false, error: PATTERN_LENGTH };
  }
  const problem = compileProblem(value);
  return problem === undefined
    ? { ok: true, value }
    : { ok: false, error: problem };
}

function ruleOf(
  value: unknown,
):
  | { ok: true; rule: StoredRoleRule }
  | { ok: false; error: string; field: RoleRuleField } {
  const fields = isRecord(value) ? value : {};
  const name = nameOf(fields['name']);
  if (!name.ok) return { ok: false, error: name.error, field: 'name' };
  const description = patternOf(fields['description']);
  if (!description.ok) {
    return { ok: false, error: description.error, field: 'description' };
  }
  const agentType = patternOf(fields['agentType']);
  if (!agentType.ok) {
    return { ok: false, error: agentType.error, field: 'agentType' };
  }
  if (description.value === null && agentType.value === null) {
    return { ok: false, error: PATTERN_REQUIRED, field: 'description' };
  }
  return {
    ok: true,
    rule: {
      name: name.value,
      description: description.value,
      agentType: agentType.value,
    },
  };
}

export function roleRuleFields(body: Record<string, unknown>): RoleRuleFields {
  const list = body['rules'];
  if (!Array.isArray(list)) {
    return { ok: false, error: RULES_REQUIRED, field: 'rules' };
  }
  if (list.length > MAX_RULES) {
    return { ok: false, error: TOO_MANY_RULES, field: 'rules' };
  }
  const rules: StoredRoleRule[] = [];
  for (const [index, value] of list.entries()) {
    const checked = ruleOf(value);
    if (!checked.ok) {
      return {
        ok: false,
        error: checked.error,
        field: checked.field,
        rule: index,
      };
    }
    rules.push(checked.rule);
  }
  return { ok: true, rules };
}
