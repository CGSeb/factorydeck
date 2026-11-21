import type { DeleteResult, FactoryResponse } from '../projects/types.ts';
import { fetchJson, isResponse } from './skills-api.ts';

export type LoadFactory = () => Promise<FactoryResponse | undefined>;

export type DeleteOutcome = DeleteResult | 'failed';

export type DeleteProject = (project: string) => Promise<DeleteOutcome>;

const OUTCOMES: Readonly<Record<number, DeleteResult>> = {
  200: 'deleted',
  404: 'not-found',
  409: 'has-factory',
};

export function factoryLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): LoadFactory {
  return async () => {
    const body = await fetchJson(fetchImpl, '/api/projects/factory');
    return isResponse<FactoryResponse>(body) ? body : undefined;
  };
}

export function projectDeleter(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): DeleteProject {
  return async (project) => {
    const query = new URLSearchParams({ project });
    try {
      const response = await fetchImpl(`/api/projects?${query.toString()}`, {
        method: 'DELETE',
      });
      return OUTCOMES[response.status] ?? 'failed';
    } catch {
      return 'failed';
    }
  };
}
