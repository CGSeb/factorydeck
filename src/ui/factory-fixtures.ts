import type { ProjectOption } from '../projects/label.ts';
import type { FactoryResponse, MissingFactory } from '../projects/types.ts';
import type { LoadFactory } from './factory-api.ts';

export const oldApp: MissingFactory = {
  project: '/home/dev/old-app',
  name: 'Old App',
  factoryFile: '/home/dev/old-app/docs/agents/factory.yml',
  sessions: 12,
};

export const archivedLib: MissingFactory = {
  project: '/home/dev/archived-lib',
  name: 'archived-lib',
  factoryFile: '/home/dev/archived-lib/docs/agents/factory.yml',
  sessions: 1,
};

export function factoryResponse(
  missing: MissingFactory[] = [],
  hasSessions = true,
  projects: ProjectOption[] = [],
  bugTickets: string[] = [],
): FactoryResponse {
  return {
    status: 'ok',
    refreshSeconds: 3600,
    hasSessions,
    missing,
    projects,
    bugTickets,
  };
}

export function factoryLoaderOf(response: FactoryResponse): LoadFactory {
  return () => Promise.resolve(response);
}
