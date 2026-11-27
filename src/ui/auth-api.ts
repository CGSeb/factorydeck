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
export const DATABASE_UNREACHABLE =
  'Database unreachable. Start it with pnpm db:up.';

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
