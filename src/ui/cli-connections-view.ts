import { formatCount } from './format.ts';

export const CLI_CONNECTIONS_TITLE = 'CLI connections';
export const CLI_CONNECTIONS_PATH = '/account/cli';
export const DISCONNECT = 'Disconnect';
export const DISCONNECTING = 'Disconnecting…';
export const DISCONNECT_TEXT = 'Its CLI stops sending until you log in again.';

export function machinesSummary(count: number): string {
  return `${formatCount(count)} machine${count === 1 ? '' : 's'}`;
}

export function loginCommand(origin: string): string {
  return `factorydeck login ${origin}`;
}

export function disconnectTitle(machine: string): string {
  return `Disconnect ${machine}?`;
}
