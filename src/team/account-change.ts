import type { Role } from '../auth/types.ts';

export const ROLE_INVALID = 'Role must be manager or dev';
export const ROLE_OR_ACTIVE = 'Send role or active';
export const NOT_BOTH = 'Change the role or the status, not both';

export interface ChangeRefusal {
  error: string;
  field?: string;
}

export type AccountChange =
  | { kind: 'role'; role: Role }
  | { kind: 'active'; active: unknown }
  | { kind: 'invalid'; refusal: ChangeRefusal };

const ACCOUNT_ID = /^[1-9]\d*$/;

export function accountIdOf(text: string): number | undefined {
  if (!ACCOUNT_ID.test(text)) return undefined;
  const id = Number(text);
  return Number.isSafeInteger(id) ? id : undefined;
}

function isRole(value: unknown): value is Role {
  return value === 'manager' || value === 'dev';
}

export function accountChangeOf(body: unknown): AccountChange {
  const fields =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? body
      : {};
  if ('role' in fields && 'active' in fields) {
    return { kind: 'invalid', refusal: { error: NOT_BOTH } };
  }
  if ('active' in fields) return { kind: 'active', active: fields.active };
  if (!('role' in fields)) {
    return { kind: 'invalid', refusal: { error: ROLE_OR_ACTIVE } };
  }
  const { role } = fields;
  return isRole(role)
    ? { kind: 'role', role }
    : { kind: 'invalid', refusal: { error: ROLE_INVALID, field: 'role' } };
}
