import type {
  FullOutputResponse,
  OccurrenceTable,
  OccurrencesResponse,
} from '../frictions/occurrence-types.ts';
import { type FrictionFilters, frictionsQuery } from './frictions-api.ts';
import { browserTimeZone, fetchJson, isResponse } from './skills-api.ts';

export interface OccurrenceRequest {
  filters: FrictionFilters;
  table: OccurrenceTable;
  row: string;
}

export type LoadOccurrences = (
  request: OccurrenceRequest,
) => Promise<OccurrencesResponse | undefined>;

export type LoadOutput = (
  id: number,
) => Promise<FullOutputResponse | undefined>;

const NOT_FOUND = 404;

export function outputUrl(id: number): string {
  return `/api/frictions/${String(id)}/output`;
}

export function outputLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): LoadOutput {
  return async (id) => {
    try {
      const response = await fetchImpl(outputUrl(id));
      if (response.status === NOT_FOUND) return { status: 'ok', gone: true };
      const body: unknown = await response.json();
      return isResponse<FullOutputResponse>(body) ? body : undefined;
    } catch {
      return undefined;
    }
  };
}

export function occurrencesUrl(
  { filters, table, row }: OccurrenceRequest,
  timeZone: string,
): string {
  const query = frictionsQuery(filters, timeZone);
  query.set('table', table);
  query.set('row', row);
  return `/api/frictions/occurrences?${query.toString()}`;
}

export function occurrencesLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  timeZone: () => string = browserTimeZone,
): LoadOccurrences {
  return async (request) => {
    const body = await fetchJson(
      fetchImpl,
      occurrencesUrl(request, timeZone()),
    );
    return isResponse<OccurrencesResponse>(body) ? body : undefined;
  };
}
