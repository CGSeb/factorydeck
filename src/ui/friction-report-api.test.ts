import { describe, expect, it } from 'vitest';
import { frictionReportLoader } from './frictions-api.ts';

function fetchOf(response: () => Response, urls: string[]): typeof fetch {
  return (input) => {
    urls.push(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    return Promise.resolve(response());
  };
}

describe('frictionReportLoader', () => {
  it('fetches the report with the page parameters and answers its text', async () => {
    const urls: string[] = [];
    const load = frictionReportLoader(
      fetchOf(() => new Response('# Friction report\n'), urls),
      () => 'Europe/Paris',
    );
    expect(
      await load({
        period: '30d',
        project: '/work/app',
        kind: 'tool-error',
        role: 'builder',
        issue: 12,
      }),
    ).toBe('# Friction report\n');
    expect(urls).toEqual([
      '/api/frictions/report?period=30d&tz=Europe%2FParis&project=%2Fwork%2Fapp&kind=tool-error&role=builder&issue=12',
    ]);
    await load({
      period: '7d',
      project: '/work/app',
      kind: undefined,
      session: 's-1',
    });
    expect(urls[1]).toBe(
      '/api/frictions/report?period=7d&tz=Europe%2FParis&project=%2Fwork%2Fapp&session=s-1',
    );
  });

  it('fails when the server does not answer the report', async () => {
    const load = frictionReportLoader(
      fetchOf(
        () => new Response('{"status":"unreachable"}', { status: 503 }),
        [],
      ),
      () => 'UTC',
    );
    await expect(
      load({ period: '7d', project: '/work/app', kind: undefined }),
    ).rejects.toThrow('503');
  });
});
