import type { ProjectOption } from './label.ts';

export interface MissingFactory {
  project: string;
  name: string;
  factoryFile: string;
  sessions: number;
}

export interface FactoryStatus {
  hasSessions: boolean;
  missing: MissingFactory[];
  projects: ProjectOption[];
  bugTickets: string[];
}

export type FactoryResponse =
  | ({ status: 'ok'; refreshSeconds: number } & FactoryStatus)
  | { status: 'unreachable'; refreshSeconds: number };
