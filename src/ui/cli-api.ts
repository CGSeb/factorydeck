import { DATABASE_UNREACHABLE, SERVER_UNREACHABLE } from './auth-api.ts';

export const CODE_INVALID = 'This code is not valid or has expired.';

export interface CliLogin {
  machine: string;
  userCode: string;
  account: { name: string; email: string };
}

export type CliLoginRead =
  | { status: 'ok'; login: CliLogin }
  | { status: 'invalid' }
  | { status: 'failed'; message: string };

export type ReadCliLogin = (code: string) => Promise<CliLoginRead>;

export type CliDecision = 'approve' | 'cancel';

export type CliDecisionOutcome =
  | { status: 'done' }
  | { status: 'invalid' }
  | { status: 'failed'; message: string };

export type DecideCliLogin = (
  code: string,
  decision: CliDecision,
) => Promise<CliDecisionOutcome>;

function text(body: object, key: string): string | undefined {
  const value: unknown = Object.entries(body).find(
    ([name]) => name === key,
  )?.[1];
  return typeof value === 'string' ? value : undefined;
}

export function cliLoginOf(body: unknown): CliLogin | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const account: unknown = 'account' in body ? body.account : undefined;
  if (typeof account !== 'object' || account === null) return undefined;
  const machine = text(body, 'machine');
  const userCode = text(body, 'userCode');
  const name = text(account, 'name');
  const email = text(account, 'email');
  if (
    machine === undefined ||
    userCode === undefined ||
    name === undefined ||
    email === undefined
  ) {
    return undefined;
  }
  return { machine, userCode, account: { name, email } };
}

function failure(response: Response): { status: 'failed'; message: string } {
  return {
    status: 'failed',
    message:
      response.status === 503 ? DATABASE_UNREACHABLE : SERVER_UNREACHABLE,
  };
}

function post(
  fetchImpl: typeof fetch,
  path: string,
  code: string,
): Promise<Response> {
  return fetchImpl(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  });
}

export function cliLoginReader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): ReadCliLogin {
  return async (code) => {
    try {
      const response = await post(fetchImpl, '/api/auth/cli', code);
      if (response.status === 410 || response.status === 400) {
        return { status: 'invalid' };
      }
      if (response.status !== 200) return failure(response);
      const login = cliLoginOf(await response.json());
      return login === undefined
        ? { status: 'failed', message: SERVER_UNREACHABLE }
        : { status: 'ok', login };
    } catch {
      return { status: 'failed', message: SERVER_UNREACHABLE };
    }
  };
}

export function cliLoginDecider(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): DecideCliLogin {
  return async (code, decision) => {
    try {
      const response = await post(fetchImpl, `/api/auth/cli/${decision}`, code);
      if (response.status === 204) return { status: 'done' };
      if (response.status === 410 || response.status === 400) {
        return { status: 'invalid' };
      }
      return failure(response);
    } catch {
      return { status: 'failed', message: SERVER_UNREACHABLE };
    }
  };
}
