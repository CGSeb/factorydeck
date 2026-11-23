import { describe, expect, it } from 'vitest';
import type { OccurrencesResponse } from '../frictions/occurrence-types.ts';
import { occurrencesLoader, occurrencesUrl } from './occurrences-api.ts';

describe('occurrencesUrl', () => {
  it('carries every filter of the page, the table and the row', () => {
    expect(
      occurrencesUrl(
        {
          filters: {
            period: '30d',
            project: '/work/app',
            kind: 'tool-error',
            role: 'builder',
            issue: 12,
          },
          table: 'repeated',
          row: 's-1/agent-a/ab12',
        },
        'Europe/Paris',
      ),
    ).toBe(
      '/api/frictions/occurrences?period=30d&tz=Europe%2FParis&project=%2Fwork%2Fapp&kind=tool-error&role=builder&issue=12&table=repeated&row=s-1%2Fagent-a%2Fab12',
    );
  });

  it('keeps an empty row and the session filter', () => {
    expect(
      occurrencesUrl(
        {
          filters: {
            period: '7d',
            project: undefined,
            kind: undefined,
            session: 's-1',
          },
          table: 'command',
          row: '',
        },
        'UTC',
      ),
    ).toBe(
      '/api/frictions/occurrences?period=7d&tz=UTC&session=s-1&table=command&row=',
    );
  });
});

describe('occurrencesLoader', () => {
  const request = {
    filters: { period: '7d', project: undefined, kind: undefined },
    table: 'tool',
    row: 'Bash',
  } as const;

  it('answers the response of the API', async () => {
    const body: OccurrencesResponse = { status: 'ok', occurrences: [] };
    const load = occurrencesLoader(
      () => Promise.resolve(Response.json(body)),
      () => 'UTC',
    );
    expect(await load(request)).toEqual(body);
  });

  it('answers undefined when the API does not answer', async () => {
    const load = occurrencesLoader(
      () => Promise.reject(new Error('offline')),
      () => 'UTC',
    );
    expect(await load(request)).toBeUndefined();
  });
});
