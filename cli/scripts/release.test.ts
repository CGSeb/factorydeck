import { describe, expect, it } from 'vitest';
import { type ReleaseInput, isPublished, releasePlan } from './release.ts';

const base: ReleaseInput = {
  name: 'factorydeck',
  version: '1.2.0',
  tag: 'cli-v1.2.0',
  publish: true,
  published: false,
};

describe('releasePlan', () => {
  it('publishes a version under latest when its tag matches', () => {
    expect(releasePlan(base)).toEqual({
      ok: true,
      distTag: 'latest',
      warnings: [],
    });
  });

  it.each(['1.3.0-beta.1', '2.0.0-rc.0'])(
    'publishes the pre-release %s under next',
    (version) => {
      expect(
        releasePlan({ ...base, version, tag: `cli-v${version}` }),
      ).toMatchObject({ ok: true, distTag: 'next' });
    },
  );

  it.each(['cli-v1.2.1', 'cli-v1.2', 'v1.2.0', 'cli-v01.2.0'])(
    'fails when the tag %s differs from the package version',
    (tag) => {
      expect(releasePlan({ ...base, tag })).toEqual({
        ok: false,
        error: `The tag ${tag} does not match the version 1.2.0 of cli/package.json: push the tag cli-v1.2.0, or change the version.`,
      });
    },
  );

  it('fails with a clear message when the version is already on npm', () => {
    expect(releasePlan({ ...base, published: true })).toEqual({
      ok: false,
      error:
        'factorydeck 1.2.0 is already on npm: raise the version in cli/package.json, then push its cli-v<version> tag.',
    });
  });

  it('only warns in a dry run when the version is already on npm', () => {
    expect(
      releasePlan({ ...base, publish: false, tag: undefined, published: true }),
    ).toEqual({
      ok: true,
      distTag: 'latest',
      warnings: [
        'factorydeck 1.2.0 is already on npm: raise the version in cli/package.json, then push its cli-v<version> tag.',
      ],
    });
  });

  it('checks the tag of a dry run too', () => {
    expect(
      releasePlan({ ...base, publish: false, tag: 'cli-v9.9.9' }),
    ).toMatchObject({ ok: false });
  });

  it('refuses to publish without a tag', () => {
    expect(releasePlan({ ...base, tag: undefined })).toEqual({
      ok: false,
      error:
        'Publishing needs a cli-v<version> tag: run it on the tag cli-v1.2.0, or as a dry run.',
    });
  });

  it.each(['1.2', 'v1.2.0', '1.2.0.1', ''])(
    'refuses the version %j that is not semantic',
    (version) => {
      expect(
        releasePlan({ ...base, version, tag: undefined, publish: false }),
      ).toMatchObject({ ok: false });
    },
  );
});

describe('isPublished', () => {
  function answering(status: number): typeof fetch {
    return () => Promise.resolve(new Response('{}', { status }));
  }

  it('reads 200 as published and 404 as not published', async () => {
    expect(await isPublished('factorydeck', '1.2.0', answering(200))).toBe(
      true,
    );
    expect(await isPublished('factorydeck', '1.2.0', answering(404))).toBe(
      false,
    );
  });

  it('fails on any other answer', async () => {
    await expect(
      isPublished('factorydeck', '1.2.0', answering(503)),
    ).rejects.toThrow('npm answered HTTP 503');
  });

  it('asks the registry for the exact version', async () => {
    const asked: string[] = [];
    const fetcher = ((url: string) => {
      asked.push(url);
      return Promise.resolve(new Response('{}', { status: 404 }));
    }) as typeof fetch;
    await isPublished('factorydeck', '1.3.0-beta.1', fetcher);
    expect(asked).toEqual([
      'https://registry.npmjs.org/factorydeck/1.3.0-beta.1',
    ]);
  });
});
