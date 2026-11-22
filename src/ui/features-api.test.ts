import { describe, expect, it } from 'vitest';
import { featureLoader, featurePath, featuresLoader } from './features-api.ts';

function recorder(urls: string[], body: unknown): typeof fetch {
  return (input) => {
    urls.push(typeof input === 'string' ? input : '');
    return Promise.resolve(Response.json(body));
  };
}

describe('features API', () => {
  it('asks for the issues of the period and project', async () => {
    const urls: string[] = [];
    const response = await featuresLoader(
      recorder(urls, { status: 'unreachable' }),
      () => 'UTC',
    )({ period: 'all', project: '/work/app' });
    expect(response).toEqual({ status: 'unreachable' });
    expect(urls).toEqual([
      '/api/features?period=all&tz=UTC&project=%2Fwork%2Fapp',
    ]);
  });

  it('asks for one issue of a project', async () => {
    const urls: string[] = [];
    const response = await featureLoader(
      recorder(urls, { status: 'not-found', refreshSeconds: 10 }),
      () => 'UTC',
    )(
      { project: '/work/app', number: 7 },
      { period: '7d', project: undefined },
    );
    expect(response).toEqual({ status: 'not-found', refreshSeconds: 10 });
    expect(urls).toEqual([
      '/api/features/7?period=7d&tz=UTC&project=%2Fwork%2Fapp',
    ]);
  });

  it('gives nothing for an unexpected answer', async () => {
    await expect(
      featuresLoader(
        recorder([], { error: 'nope' }),
        () => 'UTC',
      )({
        period: '7d',
        project: undefined,
      }),
    ).resolves.toBeUndefined();
  });

  it('links an issue page with its URL-encoded project and period', () => {
    expect(
      featurePath({ project: '/work/my app', number: 7 }, { period: 'all' }),
    ).toBe('/features/7?project=%2Fwork%2Fmy+app&period=all');
  });
});
