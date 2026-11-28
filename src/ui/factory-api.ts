import type { FactoryResponse } from '../projects/types.ts';
import { fetchJson, isResponse } from './skills-api.ts';

export type LoadFactory = () => Promise<FactoryResponse | undefined>;

export function factoryLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): LoadFactory {
  return async () => {
    const body = await fetchJson(fetchImpl, '/api/projects/factory');
    return isResponse<FactoryResponse>(body) ? body : undefined;
  };
}
