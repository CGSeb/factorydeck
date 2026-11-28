import { appendFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import manifest from '../package.json' with { type: 'json' };

export const TAG_PREFIX = 'cli-v';
const REGISTRY = 'https://registry.npmjs.org';
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;

export interface ReleaseInput {
  name: string;
  version: string;
  tag: string | undefined;
  publish: boolean;
  published: boolean;
}

export type Release =
  | { ok: true; distTag: 'latest' | 'next'; warnings: string[] }
  | { ok: false; error: string };

export function releasePlan(input: ReleaseInput): Release {
  const { name, version, tag, publish, published } = input;
  if (!SEMVER.test(version)) {
    return {
      ok: false,
      error: `The version ${version} of cli/package.json is not a semantic version.`,
    };
  }
  if (tag !== undefined && tag !== `${TAG_PREFIX}${version}`) {
    return {
      ok: false,
      error: `The tag ${tag} does not match the version ${version} of cli/package.json: push the tag ${TAG_PREFIX}${version}, or change the version.`,
    };
  }
  if (publish && tag === undefined) {
    return {
      ok: false,
      error: `Publishing needs a ${TAG_PREFIX}<version> tag: run it on the tag ${TAG_PREFIX}${version}, or as a dry run.`,
    };
  }
  const alreadyThere = `${name} ${version} is already on npm: raise the version in cli/package.json, then push its ${TAG_PREFIX}<version> tag.`;
  if (published && publish) return { ok: false, error: alreadyThere };
  return {
    ok: true,
    distTag: version.includes('-') ? 'next' : 'latest',
    warnings: published ? [alreadyThere] : [],
  };
}

export async function isPublished(
  name: string,
  version: string,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const url = `${REGISTRY}/${encodeURIComponent(name)}/${encodeURIComponent(version)}`;
  const response = await fetcher(url, {
    headers: { accept: 'application/json' },
  });
  if (response.status === 404) return false;
  if (response.ok) return true;
  throw new Error(`npm answered HTTP ${response.status} for ${url}.`);
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      tag: { type: 'string' },
      publish: { type: 'boolean', default: false },
    },
  });
  const tag =
    values.tag === undefined || values.tag === '' ? undefined : values.tag;
  const plan = releasePlan({
    name: manifest.name,
    version: manifest.version,
    tag,
    publish: values.publish,
    published: await isPublished(manifest.name, manifest.version),
  });
  if (!plan.ok) {
    process.stderr.write(`::error::${plan.error}\n`);
    return 1;
  }
  for (const warning of plan.warnings) {
    process.stdout.write(`::warning::${warning}\n`);
  }
  const lines = `version=${manifest.version}\ndist-tag=${plan.distTag}\n`;
  process.stdout.write(lines);
  const output = process.env['GITHUB_OUTPUT'];
  if (output !== undefined && output !== '') await appendFile(output, lines);
  return 0;
}

if (import.meta.main) process.exitCode = await main();
