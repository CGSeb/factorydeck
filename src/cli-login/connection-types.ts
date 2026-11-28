export interface CliConnectionItem {
  id: number;
  machine: string;
  createdAt: string;
  lastUsedAt: string;
}

export type CliConnectionsResponse =
  | { status: 'ok'; refreshSeconds: number; connections: CliConnectionItem[] }
  | { status: 'unreachable'; refreshSeconds: number };

export const CONNECTION_NOT_FOUND = 'Connection not found';
