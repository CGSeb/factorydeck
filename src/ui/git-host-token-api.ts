import { NO_SECRET_KEY } from '../team/git-host-kind.ts';
import type { GitHostKind } from '../team/host-cli.ts';
import { DATABASE_UNREACHABLE, SERVER_UNREACHABLE } from './auth-api.ts';
import { PROJECTS_URL } from './projects-api.ts';

export type { GitHostKind };

export type GitHostField = 'token' | 'gitHost';

export interface TokenState {
  gitHost: GitHostKind | null;
  tokenSet: boolean;
  tokenSetAt: string | null;
  tokenSetBy: { name: string } | null;
}

export interface TokenInput {
  token: string;
  gitHost?: GitHostKind | undefined;
}

export type SaveTokenOutcome =
  | { status: 'saved'; token: TokenState; defaultBranch: string }
  | { status: 'invalid'; field: GitHostField; message: string }
  | { status: 'missing' }
  | { status: 'no-key' }
  | { status: 'failed'; message: string };

export type SaveToken = (
  id: number,
  input: TokenInput,
) => Promise<SaveTokenOutcome>;

export type RemoveTokenOutcome =
  | { status: 'removed' }
  | { status: 'missing' }
  | { status: 'failed'; message: string };

export type RemoveToken = (id: number) => Promise<RemoveTokenOutcome>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isGitHost(value: unknown): value is GitHostKind | null {
  return value === null || value === 'github' || value === 'gitlab';
}

function isSetBy(value: unknown): value is { name: string } | null {
  return (
    value === null || (isRecord(value) && typeof value['name'] === 'string')
  );
}

function savedOf(body: unknown): SaveTokenOutcome | undefined {
  if (!isRecord(body)) return undefined;
  const { gitHost, tokenSetAt, tokenSetBy, defaultBranch } = body;
  if (
    !isGitHost(gitHost) ||
    body['tokenSet'] !== true ||
    typeof tokenSetAt !== 'string' ||
    !isSetBy(tokenSetBy) ||
    typeof defaultBranch !== 'string'
  ) {
    return undefined;
  }
  return {
    status: 'saved',
    token: { gitHost, tokenSet: true, tokenSetAt, tokenSetBy },
    defaultBranch,
  };
}

function errorOf(body: unknown): string | undefined {
  const error = isRecord(body) ? body['error'] : undefined;
  return typeof error === 'string' && error !== '' ? error : undefined;
}

function fieldOf(body: unknown): GitHostField | undefined {
  const field = isRecord(body) ? body['field'] : undefined;
  return field === 'token' || field === 'gitHost' ? field : undefined;
}

function refusalOf(status: number, body: unknown): SaveTokenOutcome {
  if (status === 404) return { status: 'missing' };
  const message = errorOf(body);
  if (status === 503) {
    if (message === NO_SECRET_KEY) return { status: 'no-key' };
    return { status: 'failed', message: message ?? DATABASE_UNREACHABLE };
  }
  if (status === 401 || message === undefined) {
    return { status: 'failed', message: SERVER_UNREACHABLE };
  }
  const field = fieldOf(body);
  if ((status === 400 || status === 422) && field !== undefined) {
    return { status: 'invalid', field, message };
  }
  return { status: 'failed', message };
}

function tokenUrl(id: number): string {
  return `${PROJECTS_URL}/${String(id)}/git-host`;
}

export function tokenSaver(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): SaveToken {
  return async (id, input) => {
    let response: Response;
    try {
      response = await fetchImpl(tokenUrl(id), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
    } catch {
      return { status: 'failed', message: SERVER_UNREACHABLE };
    }
    const body: unknown = await response.json().catch(() => undefined);
    if (response.status === 200) {
      return savedOf(body) ?? { status: 'failed', message: SERVER_UNREACHABLE };
    }
    return refusalOf(response.status, body);
  };
}

export function tokenRemover(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): RemoveToken {
  return async (id) => {
    let response: Response;
    try {
      response = await fetchImpl(`${tokenUrl(id)}/token`, {
        method: 'DELETE',
      });
    } catch {
      return { status: 'failed', message: SERVER_UNREACHABLE };
    }
    if (response.status === 204) return { status: 'removed' };
    if (response.status === 404) return { status: 'missing' };
    if (response.status === 503) {
      return { status: 'failed', message: DATABASE_UNREACHABLE };
    }
    return { status: 'failed', message: SERVER_UNREACHABLE };
  };
}
