import type {
  TeamCliConnection,
  TeamCliConnectionsResponse,
} from '../team/types.ts';
import { DATABASE_UNREACHABLE, SERVER_UNREACHABLE } from './auth-api.ts';
import { isResponse } from './skills-api.ts';

export type CliConnectionsView =
  | { status: 'ok'; connections: readonly TeamCliConnection[] }
  | { status: 'refused' }
  | { status: 'failed'; message: string };

export type DisconnectOutcome =
  | { status: 'done' }
  | { status: 'refused' }
  | { status: 'failed'; message: string };

export interface TeamCliActions {
  load: (accountId: number) => Promise<CliConnectionsView>;
  disconnect: (
    accountId: number,
    connectionId: number,
  ) => Promise<DisconnectOutcome>;
}

const SERVER_FAILED = {
  status: 'failed',
  message: SERVER_UNREACHABLE,
} as const;
const DATABASE_FAILED = {
  status: 'failed',
  message: DATABASE_UNREACHABLE,
} as const;

function pathOf(accountId: number, connectionId?: number): string {
  const base = `/api/team/accounts/${String(accountId)}/cli-connections`;
  return connectionId === undefined ? base : `${base}/${String(connectionId)}`;
}

async function viewOf(response: Response): Promise<CliConnectionsView> {
  if (response.status === 403) return { status: 'refused' };
  if (response.status === 503) return DATABASE_FAILED;
  if (response.status !== 200) return SERVER_FAILED;
  const body: unknown = await response.json().catch(() => undefined);
  if (
    !isResponse<TeamCliConnectionsResponse>(body) ||
    body.status !== 'ok' ||
    !Array.isArray(body.connections)
  ) {
    return SERVER_FAILED;
  }
  return { status: 'ok', connections: body.connections };
}

function disconnectOutcomeOf(response: Response): DisconnectOutcome {
  if (response.status === 204 || response.status === 404) {
    return { status: 'done' };
  }
  if (response.status === 403) return { status: 'refused' };
  if (response.status === 503) return DATABASE_FAILED;
  return SERVER_FAILED;
}

export function teamCliActions(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): TeamCliActions {
  return {
    load: async (accountId) => {
      try {
        return await viewOf(await fetchImpl(pathOf(accountId)));
      } catch {
        return SERVER_FAILED;
      }
    },
    disconnect: async (accountId, connectionId) => {
      try {
        return disconnectOutcomeOf(
          await fetchImpl(pathOf(accountId, connectionId), {
            method: 'DELETE',
          }),
        );
      } catch {
        return SERVER_FAILED;
      }
    },
  };
}
