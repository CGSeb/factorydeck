import type {
  CliConnectionItem,
  CliConnectionsView,
  DisconnectCliConnection,
  DisconnectOutcome,
  LoadCliConnections,
} from './cli-connections-api.ts';

export const CONNECTIONS_NOW = new Date('2026-03-12T10:00:00Z');
export const DEMO_ORIGIN = 'https://deck.example.test';

export const someConnections: CliConnectionItem[] = [
  {
    id: 3,
    machine: 'ada-laptop',
    createdAt: '2026-03-02T08:15:00Z',
    lastUsedAt: '2026-03-12T09:58:00Z',
  },
  {
    id: 1,
    machine: 'build-box.example.test',
    createdAt: '2026-02-11T16:40:00Z',
    lastUsedAt: '2026-03-12T07:00:00Z',
  },
  {
    id: 2,
    machine: 'old-desktop',
    createdAt: '2026-01-20T10:00:00Z',
    lastUsedAt: '2026-03-01T10:00:00Z',
  },
];

export function connectionsResponse(
  connections: CliConnectionItem[],
): CliConnectionsView {
  return { status: 'ok', refreshSeconds: 3600, connections };
}

export function connectionsLoaderOf(
  view: CliConnectionsView | undefined,
): LoadCliConnections {
  return () => Promise.resolve(view);
}

export function pendingConnections(): LoadCliConnections {
  return () => new Promise<undefined>(() => undefined);
}

export function disconnectAnswer(
  outcome: DisconnectOutcome,
): DisconnectCliConnection {
  return () => Promise.resolve(outcome);
}

export function pendingDisconnect(): DisconnectCliConnection {
  return () => new Promise<DisconnectOutcome>(() => undefined);
}
