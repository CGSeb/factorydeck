import type { CollectionResponse } from '../git-host/types.ts';
import { fetchJson, isResponse } from './skills-api.ts';

export type LoadCollection = () => Promise<CollectionResponse | undefined>;

export type RefreshCollection = () => Promise<CollectionResponse | undefined>;

export function collectionLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): LoadCollection {
  return async () => {
    const body = await fetchJson(fetchImpl, '/api/git-host');
    return isResponse<CollectionResponse>(body) ? body : undefined;
  };
}

export function collectionRefresher(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): RefreshCollection {
  return async () => {
    try {
      const response = await fetchImpl('/api/git-host/refresh', {
        method: 'POST',
      });
      const body: unknown = await response.json();
      return isResponse<CollectionResponse>(body) ? body : undefined;
    } catch {
      return undefined;
    }
  };
}
