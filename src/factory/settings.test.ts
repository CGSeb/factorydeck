import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { FactorySettingsError, readFactorySettings } from './settings.ts';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'factorydeck-settings-'));
  await mkdir(join(root, 'docs', 'agents'), { recursive: true });
});

async function factory(text: string): Promise<void> {
  await writeFile(join(root, 'docs', 'agents', 'factory.yml'), text);
}

async function failure(read: () => Promise<unknown>): Promise<string> {
  const error: unknown = await read().then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  if (!(error instanceof FactorySettingsError))
    throw new Error('Expected a failure');
  return error.message;
}

const SETTINGS = `version: 2
repository:
  git_host: ' github '
  empty: ''
  count: 3
build:
  auto_merge: false
`;

describe('readFactorySettings', () => {
  it('reads trimmed texts and flags by dotted key', async () => {
    await factory(SETTINGS);
    const settings = await readFactorySettings(root);
    expect(settings.text('repository.git_host')).toBe('github');
    expect(settings.requireText('repository.git_host')).toBe('github');
    expect(settings.flag('build.auto_merge')).toBe(false);
    expect(settings.requireFlag('build.auto_merge')).toBe(false);
  });

  it('reads a missing, empty or wrongly typed value as undefined', async () => {
    await factory(SETTINGS);
    const settings = await readFactorySettings(root);
    expect(settings.text('repository.empty')).toBeUndefined();
    expect(settings.text('repository.count')).toBeUndefined();
    expect(settings.text('issues.labels.ready')).toBeUndefined();
    expect(settings.flag('repository.git_host')).toBeUndefined();
  });

  it('names the key a required reader misses', async () => {
    await factory(SETTINGS);
    const settings = await readFactorySettings(root);
    expect(() => settings.requireText('issues.labels.ready')).toThrow(
      'docs/agents/factory.yml has no issues.labels.ready',
    );
    expect(() => settings.requireFlag('repository.git_host')).toThrow(
      'docs/agents/factory.yml has no repository.git_host',
    );
  });

  it('reports a missing file and invalid YAML', async () => {
    expect(await failure(() => readFactorySettings(root))).toBe(
      'docs/agents/factory.yml not found',
    );
    await factory('repository: [unclosed');
    expect(await failure(() => readFactorySettings(root))).toBe(
      'docs/agents/factory.yml is not valid YAML',
    );
  });
});
