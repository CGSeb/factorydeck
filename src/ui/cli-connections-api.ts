import type {
  CliConnectionItem,
  CliConnectionsResponse,
} from '../cli-login/connection-types.ts';
import { DATABASE_UNREACHABLE, SERVER_UNREACHABLE } from './auth-api.ts';

export type { CliConnectionItem };

export const CLI_CONNECTIONS_URL = '/api/account/cli-connections';

export type CliConnectionsView = CliConnectionsResponse;

export type LoadCliConnections = () => Promise<CliConnectionsView | undefined>;

export type DisconnectOutcome =
  { status: 'disconnected' } | { status: 'failed'; message: string };

export type DisconnectCliConnection = (
  id: number,
) => Promise<DisconnectOutcome>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isConnection(value: unknown): value is CliConnectionItem {
  return (
    isRecord(value) &&
    typeof value['id'] === 'number' &&
    typeof value['machine'] === 'string' &&
    typeof value['createdAt'] === 'string' &&
    typeof value['lastUsedAt'] === 'string'
  );
}

function viewOf(body: unknown): CliConnectionsView | undefined {
  if (!isRecord(body) || typeof body['refreshSeconds'] !== 'number') {
    return undefined;
  }
  const refreshSeconds = body['refreshSeconds'];
  if (body['status'] === 'unreachable') {
    return { status: 'unreachable', refreshSeconds };
  }
  const connections: unknown = body['connections'];
  if (
    body['status'] !== 'ok' ||
    !Array.isArray(connections) ||
    !connections.every(isConnection)
  ) {
    return undefined;
  }
  return { status: 'ok', refreshSeconds, connections };
}

export function cliConnectionsLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): LoadCliConnections {
  return async () => {
    try {
      const response = await fetchImpl(CLI_CONNECTIONS_URL);
      if (response.status !== 200 && response.status !== 503) return undefined;
      return viewOf(await response.json());
    } catch {
      return undefined;
    }
  };
}

export function cliConnectionDisconnecter(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): DisconnectCliConnection {
  return async (id) => {
    let response: Response;
    try {
      response = await fetchImpl(`${CLI_CONNECTIONS_URL}/${String(id)}`, {
        method: 'DELETE',
      });
    } catch {
      return { status: 'failed', message: SERVER_UNREACHABLE };
    }
    if (response.status === 204 || response.status === 404) {
      return { status: 'disconnected' };
    }
    if (response.status === 503) {
      return { status: 'failed', message: DATABASE_UNREACHABLE };
    }
    return { status: 'failed', message: SERVER_UNREACHABLE };
  };
}
