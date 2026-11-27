import type {
  CreatedInvitation,
  InvitationsResponse,
  TeamInvitation,
} from '../team/types.ts';
import type { Account, Role } from './auth-api.ts';
import { DATABASE_UNREACHABLE, SERVER_UNREACHABLE } from './auth-api.ts';

export type { CreatedInvitation, TeamInvitation };

export interface InviteInput {
  email: string;
  role: Role;
}

export type InviteField = 'email' | 'role';

export type InviteOutcome =
  | { status: 'created'; invitation: CreatedInvitation }
  | { status: 'invalid'; field: InviteField; message: string }
  | { status: 'failed'; message: string };

export type RowOutcome =
  | { status: 'created'; invitation: CreatedInvitation }
  | { status: 'failed'; message: string };

export type RevokeOutcome =
  { status: 'revoked' } | { status: 'failed'; message: string };

export interface InvitationActions {
  invite: (input: InviteInput) => Promise<InviteOutcome>;
  newLink: (id: number) => Promise<RowOutcome>;
  revoke: (id: number) => Promise<RevokeOutcome>;
}

export type InvitationRead =
  | { status: 'pending'; email: string; role: Role }
  | { status: 'dead' }
  | { status: 'unreachable'; message: string };

export type ReadInvitation = (token: string) => Promise<InvitationRead>;

export type AcceptField = 'name' | 'password';

export interface AcceptInput {
  token: string;
  name: string;
  password: string;
}

export type AcceptOutcome =
  | { status: 'created'; account: Account }
  | { status: 'dead' }
  | { status: 'invalid'; field: AcceptField; message: string }
  | { status: 'failed'; message: string };

export type AcceptInvitation = (input: AcceptInput) => Promise<AcceptOutcome>;

const ROLES: readonly string[] = ['manager', 'dev'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorOf(body: unknown): string | undefined {
  if (!isRecord(body)) return undefined;
  return typeof body['error'] === 'string' && body['error'] !== ''
    ? body['error']
    : undefined;
}

function isInvitation(body: unknown): body is TeamInvitation {
  return (
    isRecord(body) &&
    typeof body['id'] === 'number' &&
    typeof body['email'] === 'string' &&
    typeof body['role'] === 'string' &&
    ROLES.includes(body['role']) &&
    (body['invitedBy'] === null || typeof body['invitedBy'] === 'string') &&
    typeof body['createdAt'] === 'string' &&
    typeof body['expiresAt'] === 'string'
  );
}

function isCreated(body: unknown): body is CreatedInvitation {
  return (
    isInvitation(body) && isRecord(body) && typeof body['token'] === 'string'
  );
}

async function bodyOf(response: Response): Promise<unknown> {
  return response.json().catch((): unknown => undefined);
}

function failure(response: Response, body: unknown): string {
  if (response.status === 503) return DATABASE_UNREACHABLE;
  return errorOf(body) ?? SERVER_UNREACHABLE;
}

async function send(
  fetchImpl: typeof fetch,
  url: string,
  method: string,
  body?: unknown,
): Promise<Response | undefined> {
  try {
    return await fetchImpl(url, {
      method,
      ...(body === undefined
        ? {}
        : {
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          }),
    });
  } catch {
    return undefined;
  }
}

export function invitationsLoader(
  fetchImpl: typeof fetch,
): () => Promise<InvitationsResponse | undefined> {
  return async () => {
    try {
      const response = await fetchImpl('/api/team/invitations');
      if (response.status !== 200 && response.status !== 503) return undefined;
      const body: unknown = await response.json();
      if (!isRecord(body) || typeof body['refreshSeconds'] !== 'number') {
        return undefined;
      }
      const refreshSeconds = body['refreshSeconds'];
      if (body['status'] === 'unreachable') {
        return { status: 'unreachable', refreshSeconds };
      }
      const invitations: unknown = body['invitations'];
      if (
        body['status'] !== 'ok' ||
        !Array.isArray(invitations) ||
        !invitations.every(isInvitation)
      ) {
        return undefined;
      }
      return { status: 'ok', refreshSeconds, invitations };
    } catch {
      return undefined;
    }
  };
}

async function created(response: Response | undefined): Promise<RowOutcome> {
  if (response === undefined) {
    return { status: 'failed', message: SERVER_UNREACHABLE };
  }
  const body = await bodyOf(response);
  if (response.status === 201 && isCreated(body)) {
    return { status: 'created', invitation: body };
  }
  return { status: 'failed', message: failure(response, body) };
}

export function invitationActions(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): InvitationActions {
  return {
    invite: async (input) => {
      const response = await send(
        fetchImpl,
        '/api/team/invitations',
        'POST',
        input,
      );
      if (response?.status === 400) {
        const body = await bodyOf(response);
        const message = errorOf(body);
        const field = isRecord(body) ? body['field'] : undefined;
        if (message !== undefined && (field === 'email' || field === 'role')) {
          return { status: 'invalid', field, message };
        }
        return { status: 'failed', message: message ?? SERVER_UNREACHABLE };
      }
      if (response?.status === 409) {
        const message = errorOf(await bodyOf(response));
        if (message !== undefined) {
          return { status: 'invalid', field: 'email', message };
        }
      }
      return created(response);
    },
    newLink: async (id) =>
      created(
        await send(fetchImpl, `/api/team/invitations/${id}/new-link`, 'POST'),
      ),
    revoke: async (id) => {
      const response = await send(
        fetchImpl,
        `/api/team/invitations/${id}`,
        'DELETE',
      );
      if (response === undefined) {
        return { status: 'failed', message: SERVER_UNREACHABLE };
      }
      if (response.status === 204) return { status: 'revoked' };
      return {
        status: 'failed',
        message: failure(response, await bodyOf(response)),
      };
    },
  };
}

export function invitationReader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): ReadInvitation {
  return async (token) => {
    const response = await send(fetchImpl, '/api/auth/invitation', 'POST', {
      token,
    });
    if (response === undefined) {
      return { status: 'unreachable', message: SERVER_UNREACHABLE };
    }
    if (response.status === 410) return { status: 'dead' };
    if (response.status === 503) {
      return { status: 'unreachable', message: DATABASE_UNREACHABLE };
    }
    const body = await bodyOf(response);
    if (
      response.status === 200 &&
      isRecord(body) &&
      typeof body['email'] === 'string' &&
      (body['role'] === 'manager' || body['role'] === 'dev')
    ) {
      return { status: 'pending', email: body['email'], role: body['role'] };
    }
    return { status: 'unreachable', message: SERVER_UNREACHABLE };
  };
}

function accountOf(body: unknown): Account | undefined {
  if (
    !isRecord(body) ||
    typeof body['id'] !== 'number' ||
    typeof body['email'] !== 'string' ||
    typeof body['name'] !== 'string' ||
    (body['role'] !== 'manager' && body['role'] !== 'dev')
  ) {
    return undefined;
  }
  return {
    id: body['id'],
    email: body['email'],
    name: body['name'],
    role: body['role'],
  };
}

export function invitationAccepter(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): AcceptInvitation {
  return async (input) => {
    const response = await send(
      fetchImpl,
      '/api/auth/invitation/accept',
      'POST',
      input,
    );
    if (response === undefined) {
      return { status: 'failed', message: SERVER_UNREACHABLE };
    }
    if (response.status === 410) return { status: 'dead' };
    const body = await bodyOf(response);
    if (response.status === 201) {
      const account = accountOf(body);
      return account === undefined
        ? { status: 'failed', message: SERVER_UNREACHABLE }
        : { status: 'created', account };
    }
    const message = errorOf(body);
    const field = isRecord(body) ? body['field'] : undefined;
    if (
      response.status === 400 &&
      message !== undefined &&
      (field === 'name' || field === 'password')
    ) {
      return { status: 'invalid', field, message };
    }
    return { status: 'failed', message: failure(response, body) };
  };
}

export function inviteLink(origin: string, token: string): string {
  return `${origin}/invite/${token}`;
}
