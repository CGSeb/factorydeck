import type { Role } from '../auth/types.ts';
import type { TeamAccountRow } from '../team/types.ts';
import { DATABASE_UNREACHABLE, SERVER_UNREACHABLE } from './auth-api.ts';

export type AccountChangeOutcome =
  | { status: 'changed'; account: TeamAccountRow }
  | { status: 'refused' }
  | { status: 'failed'; message: string };

export type ChangeRole = (
  accountId: number,
  role: Role,
) => Promise<AccountChangeOutcome>;

const ROLES: readonly unknown[] = ['manager', 'dev'];

function hasIdentity(body: object): boolean {
  return (
    'id' in body &&
    typeof body.id === 'number' &&
    'name' in body &&
    typeof body.name === 'string' &&
    'email' in body &&
    typeof body.email === 'string'
  );
}

function isTeamRow(body: unknown): body is TeamAccountRow {
  return (
    typeof body === 'object' &&
    body !== null &&
    hasIdentity(body) &&
    'role' in body &&
    ROLES.includes(body.role) &&
    'active' in body &&
    typeof body.active === 'boolean' &&
    'lastSignInAt' in body &&
    (body.lastSignInAt === null || typeof body.lastSignInAt === 'string') &&
    'you' in body &&
    typeof body.you === 'boolean'
  );
}

function messageOf(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return undefined;
  }
  return typeof body.error === 'string' && body.error !== ''
    ? body.error
    : undefined;
}

export async function accountChangeOutcome(
  response: Response,
): Promise<AccountChangeOutcome> {
  if (response.status === 403) return { status: 'refused' };
  if (response.status === 503) {
    return { status: 'failed', message: DATABASE_UNREACHABLE };
  }
  const body: unknown = await response.json().catch(() => undefined);
  if (response.status === 200) {
    return isTeamRow(body)
      ? { status: 'changed', account: body }
      : { status: 'failed', message: SERVER_UNREACHABLE };
  }
  const message = response.status === 404 ? undefined : messageOf(body);
  return { status: 'failed', message: message ?? SERVER_UNREACHABLE };
}

export function roleChanger(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): ChangeRole {
  return async (accountId, role) => {
    try {
      const response = await fetchImpl(`/api/team/accounts/${accountId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      return await accountChangeOutcome(response);
    } catch {
      return { status: 'failed', message: SERVER_UNREACHABLE };
    }
  };
}
