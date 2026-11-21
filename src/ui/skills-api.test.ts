import { describe, expect, it } from 'vitest';
import { skillLoader, skillPath, skillsLoader } from './skills-api.ts';

function recording(body: unknown): { urls: string[]; fetch: typeof fetch } {
  const urls: string[] = [];
  return {
    urls,
    fetch: (input) => {
      urls.push(typeof input === 'string' ? input : '');
      return Promise.resolve(Response.json(body));
    },
  };
}

describe('skills API', () => {
  it('asks for the skills of the period and project', async () => {
    const { urls, fetch } = recording({ status: 'unreachable' });
    const response = await skillsLoader(
      fetch,
      () => 'UTC',
    )({
      period: '30d',
      project: '/work/app',
    });
    expect(response).toEqual({ status: 'unreachable' });
    expect(urls).toEqual([
      '/api/skills?period=30d&tz=UTC&project=%2Fwork%2Fapp',
    ]);
  });

  it('encodes the skill name', async () => {
    const { urls, fetch } = recording({ status: 'unreachable' });
    await skillLoader(fetch, () => 'UTC')('kit:write-spec', {
      period: 'all',
      project: undefined,
    });
    expect(urls).toEqual(['/api/skills/kit%3Awrite-spec?period=all&tz=UTC']);
    expect(skillPath('a/b', '?period=7d')).toBe('/skills/a%2Fb?period=7d');
  });

  it('gives nothing for an unexpected answer', async () => {
    const { fetch } = recording({ error: 'nope' });
    await expect(
      skillsLoader(fetch, () => 'UTC')({ period: '7d', project: undefined }),
    ).resolves.toBeUndefined();
  });
});
