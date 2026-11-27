import type { Account, Role } from '../auth/types.ts';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';

export type LoadAuthState = () => Promise<{ setup: boolean } | undefined>;

export type SetupField = 'code' | 'email' | 'name' | 'password';

export interface SetupInput {
  code: string;
  email: string;
  name: string;
  password: string;
}

export type SetupOutcome =
  | { status: 'created' }
  | { status: 'failed'; message: string }
  | { status: 'invalid'; field: SetupField; message: string };

export type SetupManager = (input: SetupInput) => Promise<SetupOutcome>;

export const SERVER_UNREACHABLE = 'Could not reach the server';
export const DATABASE_UNREACHABLE = UNREACHABLE_MESSAGE;

const FIELDS: readonly SetupField[] = ['code', 'email', 'name', 'password'];

function isSetupField(value: unknown): value is SetupField {
  return (
    typeof value === 'string' && (FIELDS as readonly string[]).includes(value)
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

export function authStateLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): LoadAuthState {
  return async () => {
    try {
      const response = await fetchImpl('/api/auth/state');
      if (!response.ok) return undefined;
      const body: unknown = await response.json();
      if (
        typeof body === 'object' &&
        body !== null &&
        'setup' in body &&
        typeof body.setup === 'boolean'
      ) {
        return { setup: body.setup };
      }
      return undefined;
    } catch {
      return undefined;
    }
  };
}

export function managerSetup(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): SetupManager {
  return async (input) => {
    let response: Response;
    try {
      response = await fetchImpl('/api/auth/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
    } catch {
      return { status: 'failed', message: SERVER_UNREACHABLE };
    }
    if (response.status === 201) return { status: 'created' };
    if (response.status === 503) {
      return { status: 'failed', message: DATABASE_UNREACHABLE };
    }
    const body: unknown = await response.json().catch(() => undefined);
    const message = messageOf(body);
    if (message === undefined) {
      return { status: 'failed', message: SERVER_UNREACHABLE };
    }
    if (
      response.status === 400 &&
      typeof body === 'object' &&
      body !== null &&
      'field' in body &&
      isSetupField(body.field)
    ) {
      return { status: 'invalid', field: body.field, message };
    }
    return { status: 'failed', message };
  };
}

export type MeResult =
  | { status: 'account'; account: Account }
  | { status: 'signed-out' }
  | { status: 'unreachable'; message: string };

export type LoadMe = () => Promise<MeResult>;

export type SignOutOutcome =
  { status: 'signed-out' } | { status: 'failed'; message: string };

export type SignOut = () => Promise<SignOutOutcome>;

export const SIGNED_OUT_PATH = '/';

const ROLES: readonly Role[] = ['manager', 'dev'];

function isAccount(body: unknown): body is Account {
  return (
    typeof body === 'object' &&
    body !== null &&
    'id' in body &&
    typeof body.id === 'number' &&
    'email' in body &&
    typeof body.email === 'string' &&
    'name' in body &&
    typeof body.name === 'string' &&
    'role' in body &&
    typeof body.role === 'string' &&
    (ROLES as readonly string[]).includes(body.role)
  );
}

export function meLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): LoadMe {
  return async () => {
    try {
      const response = await fetchImpl('/api/auth/me');
      if (response.status === 401) return { status: 'signed-out' };
      if (response.status === 503) {
        return { status: 'unreachable', message: DATABASE_UNREACHABLE };
      }
      const body: unknown = response.ok ? await response.json() : undefined;
      if (isAccount(body)) {
        const { id, email, name, role } = body;
        return { status: 'account', account: { id, email, name, role } };
      }
      return { status: 'unreachable', message: SERVER_UNREACHABLE };
    } catch {
      return { status: 'unreachable', message: SERVER_UNREACHABLE };
    }
  };
}

export function signOuter(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): SignOut {
  return async () => {
    try {
      const response = await fetchImpl('/api/auth/sign-out', {
        method: 'POST',
      });
      if (response.status === 204) return { status: 'signed-out' };
      return {
        status: 'failed',
        message:
          response.status === 503 ? DATABASE_UNREACHABLE : SERVER_UNREACHABLE,
      };
    } catch {
      return { status: 'failed', message: SERVER_UNREACHABLE };
    }
  };
}

export function pageLeaver(
  location: Pick<Location, 'replace'> = window.location,
): (path: string) => void {
  return (path) => {
    location.replace(path);
  };
}
