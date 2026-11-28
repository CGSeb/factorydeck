import type { TeamCliConnection } from '../team/types.ts';
import type {
  CliConnectionsView,
  DisconnectOutcome,
  TeamCliActions,
} from './team-cli-api.ts';
import { TEAM_NOW } from './team-fixtures.ts';

function minutesAgo(minutes: number): string {
  return new Date(TEAM_NOW.getTime() - minutes * 60_000).toISOString();
}

export const laptop: TeamCliConnection = {
  id: 11,
  machine: 'bruno-laptop',
  createdAt: minutesAgo(12 * 24 * 60),
  lastUsedAt: minutesAgo(4),
};

export const twoMachines: TeamCliConnection[] = [
  laptop,
  {
    id: 12,
    machine: 'build-box-with-a-rather-long-host-name.internal.example.test',
    createdAt: minutesAgo(20 * 24 * 60),
    lastUsedAt: minutesAgo(3 * 24 * 60),
  },
];

export function connectionsOf(
  connections: readonly TeamCliConnection[],
): CliConnectionsView {
  return { status: 'ok', connections };
}

export function cliActionsOf(
  byAccount: Readonly<Record<number, readonly TeamCliConnection[]>>,
  outcome: DisconnectOutcome = { status: 'done' },
): TeamCliActions & { disconnected: number[] } {
  const disconnected: number[] = [];
  return {
    disconnected,
    load: (accountId) =>
      Promise.resolve(
        connectionsOf(
          (byAccount[accountId] ?? []).filter(
            ({ id }) => !disconnected.includes(id),
          ),
        ),
      ),
    disconnect: (_accountId, connectionId) => {
      if (outcome.status === 'done') disconnected.push(connectionId);
      return Promise.resolve(outcome);
    },
  };
}
