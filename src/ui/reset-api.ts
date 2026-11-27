import type { Account } from '../auth/types.ts';
import {
  DATABASE_UNREACHABLE,
  SERVER_UNREACHABLE,
  isAccount,
} from './auth-api.ts';

export const LINK_GONE =
  'This link no longer works. Ask a manager for a new one.';

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export interface CreatedResetLink {
  token: string;
  expiresAt: string;
}

export type ResetLinkOutcome =
  | { status: 'created'; link: CreatedResetLink }
  | { status: 'failed'; message: string };

export type CreateResetLink = (accountId: number) => Promise<ResetLinkOutcome>;

export type ResetReadOutcome =
  | { status: 'ok'; email: string }
  | { status: 'gone' }
  | { status: 'unreachable'; message: string };

export type ReadReset = (token: string) => Promise<ResetReadOutcome>;

export type ResetSaveOutcome =
  | { status: 'saved'; account: Account }
  | { status: 'gone' }
  | { status: 'invalid'; message: string }
  | { status: 'failed'; message: string };

export type SaveReset = (
  token: string,
  password: string,
) => Promise<ResetSaveOutcome>;

export function isResetToken(value: string | undefined): value is string {
  return value !== undefined && TOKEN.test(value);
}

export function resetLink(origin: string, token: string): string {
  return `${origin}/reset/${token}`;
}

function errorOf(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return undefined;
  }
  return typeof body.error === 'string' && body.error !== ''
    ? body.error
    : undefined;
}

function createdOf(body: unknown): CreatedResetLink | undefined {
  if (
    typeof body === 'object' &&
    body !== null &&
    'token' in body &&
    typeof body.token === 'string' &&
    'expiresAt' in body &&
    typeof body.expiresAt === 'string'
  ) {
    return { token: body.token, expiresAt: body.expiresAt };
  }
  return undefined;
}

function post(
  fetchImpl: typeof fetch,
  path: string,
  body?: unknown,
): Promise<Response> {
  return fetchImpl(
    path,
    body === undefined
      ? { method: 'POST' }
      : {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
}

async function bodyOf(response: Response): Promise<unknown> {
  return response.json().catch((): unknown => undefined);
}

export function resetLinkCreator(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): CreateResetLink {
  return async (accountId) => {
    let response: Response;
    try {
      response = await post(
        fetchImpl,
        `/api/team/accounts/${accountId}/reset-link`,
      );
    } catch {
      return { status: 'failed', message: SERVER_UNREACHABLE };
    }
    if (response.status === 503) {
      return { status: 'failed', message: DATABASE_UNREACHABLE };
    }
    const body = await bodyOf(response);
    const link = response.status === 201 ? createdOf(body) : undefined;
    if (link !== undefined) return { status: 'created', link };
    const message = response.status === 201 ? undefined : errorOf(body);
    return { status: 'failed', message: message ?? SERVER_UNREACHABLE };
  };
}

export function resetReader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): ReadReset {
  return async (token) => {
    try {
      const response = await post(fetchImpl, '/api/auth/reset', { token });
      if (response.status === 410) return { status: 'gone' };
      if (response.status === 503) {
        return { status: 'unreachable', message: DATABASE_UNREACHABLE };
      }
      const body = await bodyOf(response);
      if (
        response.status === 200 &&
        typeof body === 'object' &&
        body !== null &&
        'email' in body &&
        typeof body.email === 'string'
      ) {
        return { status: 'ok', email: body.email };
      }
      return { status: 'unreachable', message: SERVER_UNREACHABLE };
    } catch {
      return { status: 'unreachable', message: SERVER_UNREACHABLE };
    }
  };
}

export function resetSaver(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): SaveReset {
  return async (token, password) => {
    let response: Response;
    try {
      response = await post(fetchImpl, '/api/auth/reset/save', {
        token,
        password,
      });
    } catch {
      return { status: 'failed', message: SERVER_UNREACHABLE };
    }
    if (response.status === 410) return { status: 'gone' };
    if (response.status === 503) {
      return { status: 'failed', message: DATABASE_UNREACHABLE };
    }
    const body = await bodyOf(response);
    if (response.status === 200) {
      if (!isAccount(body)) {
        return { status: 'failed', message: SERVER_UNREACHABLE };
      }
      const { id, email, name, role } = body;
      return { status: 'saved', account: { id, email, name, role } };
    }
    const message = errorOf(body);
    if (response.status === 400 && message !== undefined) {
      return { status: 'invalid', message };
    }
    return { status: 'failed', message: SERVER_UNREACHABLE };
  };
}
