import type { StoredRoleRule } from '../roles/default-roles.ts';
import type { RoleRuleField } from '../roles/rule-fields.ts';
import { DATABASE_UNREACHABLE, SERVER_UNREACHABLE } from './auth-api.ts';
import { PROJECTS_URL } from './projects-api.ts';

export type { RoleRuleField, StoredRoleRule };

const MISSING_RETRY_SECONDS = 10;

export type RoleRulesView =
  | { status: 'ok'; refreshSeconds: number; rules: StoredRoleRule[] }
  | { status: 'unreachable'; refreshSeconds: number }
  | { status: 'missing'; refreshSeconds: number };

export type LoadRoleRules = (
  projectId: number,
) => Promise<RoleRulesView | undefined>;

export type SaveRoleRulesOutcome =
  | { status: 'saved'; rules: StoredRoleRule[] }
  | {
      status: 'invalid';
      field: RoleRuleField | 'rules';
      rule: number | undefined;
      message: string;
    }
  | { status: 'missing' }
  | { status: 'failed'; message: string };

export type SaveRoleRules = (
  projectId: number,
  rules: StoredRoleRule[],
) => Promise<SaveRoleRulesOutcome>;

export function roleRulesUrl(projectId: number): string {
  return `${PROJECTS_URL}/${String(projectId)}/rules/role`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPattern(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isRule(value: unknown): value is StoredRoleRule {
  return (
    isRecord(value) &&
    typeof value['name'] === 'string' &&
    isPattern(value['description']) &&
    isPattern(value['agentType'])
  );
}

function rulesOf(body: unknown): StoredRoleRule[] | undefined {
  const rules = isRecord(body) ? body['rules'] : undefined;
  if (!Array.isArray(rules) || !rules.every(isRule)) return undefined;
  return rules.map(({ name, description, agentType }) => ({
    name,
    description,
    agentType,
  }));
}

const FIELDS: readonly (RoleRuleField | 'rules')[] = [
  'rules',
  'name',
  'description',
  'agentType',
];

function refusalOf(body: unknown): SaveRoleRulesOutcome {
  if (!isRecord(body)) return { status: 'failed', message: SERVER_UNREACHABLE };
  const { error, field, rule } = body;
  const message =
    typeof error === 'string' && error !== '' ? error : SERVER_UNREACHABLE;
  const known = FIELDS.find((name) => name === field);
  if (known === undefined) return { status: 'failed', message };
  if (known === 'rules') {
    return { status: 'invalid', field: known, rule: undefined, message };
  }
  if (typeof rule !== 'number' || !Number.isInteger(rule) || rule < 0) {
    return { status: 'failed', message };
  }
  return { status: 'invalid', field: known, rule, message };
}

export function roleRulesLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): LoadRoleRules {
  return async (projectId) => {
    try {
      const response = await fetchImpl(roleRulesUrl(projectId));
      if (response.status === 404) {
        return { status: 'missing', refreshSeconds: MISSING_RETRY_SECONDS };
      }
      if (response.status !== 200 && response.status !== 503) return undefined;
      const body: unknown = await response.json();
      if (!isRecord(body) || typeof body['refreshSeconds'] !== 'number') {
        return undefined;
      }
      const refreshSeconds = body['refreshSeconds'];
      if (body['status'] === 'unreachable') {
        return { status: 'unreachable', refreshSeconds };
      }
      const rules = rulesOf(body);
      if (body['status'] !== 'ok' || rules === undefined) return undefined;
      return { status: 'ok', refreshSeconds, rules };
    } catch {
      return undefined;
    }
  };
}

export function roleRulesSaver(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): SaveRoleRules {
  return async (projectId, rules) => {
    let response: Response;
    try {
      response = await fetchImpl(roleRulesUrl(projectId), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rules }),
      });
    } catch {
      return { status: 'failed', message: SERVER_UNREACHABLE };
    }
    const body: unknown = await response.json().catch(() => undefined);
    const saved = rulesOf(body);
    if (response.status === 200 && saved !== undefined) {
      return { status: 'saved', rules: saved };
    }
    if (response.status === 404) return { status: 'missing' };
    if (response.status === 503) {
      return { status: 'failed', message: DATABASE_UNREACHABLE };
    }
    if (response.status === 400) return refusalOf(body);
    return { status: 'failed', message: SERVER_UNREACHABLE };
  };
}
