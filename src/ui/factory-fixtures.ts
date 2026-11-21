import type { FactoryResponse, MissingFactory } from '../projects/types.ts';
import type {
  DeleteOutcome,
  DeleteProject,
  LoadFactory,
} from './factory-api.ts';

export const oldApp: MissingFactory = {
  project: '/home/dev/old-app',
  name: 'old-app',
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
): FactoryResponse {
  return { status: 'ok', refreshSeconds: 3600, hasSessions, missing };
}

export function factoryLoaderOf(response: FactoryResponse): LoadFactory {
  return () => Promise.resolve(response);
}

export function deleterOf(outcome: DeleteOutcome): DeleteProject {
  return () => Promise.resolve(outcome);
}

export function pendingDeleter(): DeleteProject {
  return () => new Promise<DeleteOutcome>(() => undefined);
}
