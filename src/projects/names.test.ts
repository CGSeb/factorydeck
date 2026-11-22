import { mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { projectName as projectNameTable } from '../db/schema.ts';
import { factoryFile, hasFactory } from '../ingest/factory.ts';
import { ingest } from '../ingest/ingest.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  assistant,
  installFactory,
  sessionsFolder,
  userText,
  writeLog,
} from '../test/session-logs.ts';
import { cleanProjectName, projectNames } from './names.ts';
import { deleteProject, factoryStatus } from './remove.ts';

let db: Database;
let close: () => Promise<void>;
let logs: string;
let work: string;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
  logs = await sessionsFolder();
  work = await realpath(await sessionsFolder());
});

afterEach(async () => {
  await close();
});

async function project(folder: string, yaml?: string): Promise<string> {
  const root = join(work, folder);
  await mkdir(root, { recursive: true });
  await installFactory(root);
  if (yaml !== undefined) await writeFile(factoryFile(root), yaml);
  return root;
}

function turn(id: string, n: number, cwd: string) {
  const ctx = { uuid: `${id}-${String(n)}`, at: n, cwd };
  return [
    userText(ctx, `Prompt ${String(n)}`),
    assistant(ctx, { requestId: `${id}-req-${String(n)}` }),
  ];
}

async function writeSession(id: string, cwd: string): Promise<void> {
  await writeLog(join(logs, 'p', `${id}.jsonl`), turn(id, 0, cwd));
}

async function run(): Promise<void> {
  await ingest(db, logs);
}

async function labelOf(root: string): Promise<string> {
  return (await projectNames(db)).label(root);
}

async function storedNames(): Promise<Record<string, string>> {
  const rows = await db.select().from(projectNameTable);
  return Object.fromEntries(rows.map((row) => [row.project, row.name]));
}

describe('cleanProjectName', () => {
  it('folds line breaks, tabs and runs of spaces, and trims', () => {
    expect(cleanProjectName('  My\n\tShop   App \r\n')).toBe('My Shop App');
  });

  it('is no name when empty, only spaces or not a string', () => {
    for (const value of ['', '   ', '\n\t', 42, ['a'], { a: 1 }, null]) {
      expect(cleanProjectName(value)).toBeUndefined();
    }
  });
});

describe('project names from the ingestion', () => {
  it('stores the name read, and shows the folder name of a project without one', async () => {
    const named = await project('shop-app', 'project:\n  name: Shop App\n');
    const unnamed = await project('plain-lib');
    await writeSession('s1', named);
    await writeSession('s2', unnamed);
    await run();

    expect(await storedNames()).toEqual({ [named]: 'Shop App' });
    expect(await labelOf(named)).toBe('Shop App');
    expect(await labelOf(unnamed)).toBe('plain-lib');
    expect(await labelOf('unassigned')).toBe('unassigned');
  });

  it('picks up a rename at the next run, with no new session', async () => {
    const root = await project('shop-app', 'project:\n  name: Shop\n');
    await writeSession('s1', root);
    await run();
    await writeFile(factoryFile(root), 'project:\n  name: "  New\\tShop  "\n');
    await run();

    expect(await labelOf(root)).toBe('New Shop');
  });

  it.each([
    ['a missing name', 'project:\n  other: 1\n'],
    ['no project section', 'version: 2\n'],
    ['an empty name', 'project:\n  name: ""\n'],
    ['a name of spaces', 'project:\n  name: "   "\n'],
    ['a number', 'project:\n  name: 42\n'],
    ['a list', 'project:\n  name: [a, b]\n'],
    ['a map', 'project:\n  name:\n    a: b\n'],
    ['a project that is not a map', 'project: Shop\n'],
    ['a project that is a list', 'project:\n  - name: Shop\n'],
    ['invalid YAML', 'project: [\n'],
    ['a duplicated key', 'project:\n  name: One\n  name: Two\n'],
    ['an empty file', ''],
  ])('keeps the last name read on %s', async (_case, yaml) => {
    const root = await project('shop-app', 'project:\n  name: Shop\n');
    await writeSession('s1', root);
    await run();
    await writeFile(factoryFile(root), yaml);
    await run();

    expect(await labelOf(root)).toBe('Shop');
  });

  it('shows the folder name while no valid name was ever read', async () => {
    const root = await project('shop-app', 'project:\n  name: 42\n');
    await writeSession('s1', root);
    await run();

    expect(await labelOf(root)).toBe('shop-app');
  });

  it('keeps the last name of a project whose factory file is gone', async () => {
    const root = await project('shop-app', 'project:\n  name: Shop\n');
    await writeSession('s1', root);
    await run();
    await rm(factoryFile(root));
    await run();

    expect(await labelOf(root)).toBe('Shop');
    expect((await factoryStatus(db, hasFactory)).missing).toEqual([
      expect.objectContaining({ project: root, name: 'Shop' }),
    ]);
  });

  it('names projects stored before the upgrade at the first run', async () => {
    const root = await project('shop-app', 'project:\n  name: Shop\n');
    await writeSession('s1', root);
    await run();
    await db.delete(projectNameTable);
    expect(await labelOf(root)).toBe('shop-app');
    await run();

    expect(await labelOf(root)).toBe('Shop');
  });

  it('forgets the name of a deleted project', async () => {
    const gone = await project('gone-app', 'project:\n  name: Gone\n');
    const kept = await project('kept-app', 'project:\n  name: Kept\n');
    await writeSession('g1', gone);
    await writeSession('k1', kept);
    await run();
    await rm(factoryFile(gone));

    expect(await deleteProject(db, gone, hasFactory)).toBe('deleted');
    expect(await storedNames()).toEqual({ [kept]: 'Kept' });
  });
});

describe('duplicated names', () => {
  it('shows the root after a name shared by two projects, case-insensitively, and sorts the options', async () => {
    const web = await project('web', 'project:\n  name: Shop\n');
    const api = await project('api', 'project:\n  name: shop\n');
    const lib = await project('lib', 'project:\n  name: Alpha\n');
    await writeSession('s1', web);
    await writeSession('s2', api);
    await writeSession('s3', lib);
    await run();
    const names = await projectNames(db);

    expect(names.label(web)).toBe(`Shop (${web})`);
    expect(names.label(api)).toBe(`shop (${api})`);
    expect(names.label(lib)).toBe('Alpha');
    expect(names.options()).toEqual([
      { project: lib, name: 'Alpha' },
      { project: api, name: `shop (${api})` },
      { project: web, name: `Shop (${web})` },
    ]);
  });

  it('shows a name alone again once it is unique', async () => {
    const web = await project('web', 'project:\n  name: Shop\n');
    const api = await project('api', 'project:\n  name: Shop\n');
    await writeSession('s1', web);
    await writeSession('s2', api);
    await run();
    await writeFile(factoryFile(api), 'project:\n  name: Shop API\n');
    await run();

    expect(await labelOf(web)).toBe('Shop');
    expect(await labelOf(api)).toBe('Shop API');
  });
});
