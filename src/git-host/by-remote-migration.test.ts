import { cp, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../db/client.ts';
import { createScratchDatabase } from '../test/postgres.ts';

const MIGRATIONS = join(import.meta.dirname, '..', '..', 'drizzle');
const FIRST_BY_REMOTE = '20261128151052_git_host_by_remote';
const SHOP = 'github.com/example-org/shop';
const LIB = 'gitlab.com/example-group/lib';
const STRAY = 'github.com/example-org/stray';
const LATEST = '2026-03-12T09:00:00Z';
const OLDER = '2026-03-10T09:00:00Z';

const PAGE_QUERIES = {
  settings: `select project, git_host, repository, synced_from, error, error_git_host, stage_labels, auto_merge, bug_label, history_read, fix_read, state_events_read, body_closes_read from project_git_host order by project`,
  issues: `select * from project_issue order by project, number`,
  requests: `select * from project_request order by project, number`,
};

let url: string;
let drop: () => Promise<void>;
let folder: string;

async function migrationsBefore(name: string): Promise<string> {
  const copy = await mkdtemp(join(tmpdir(), 'factorydeck-migrations-'));
  for (const entry of await readdir(MIGRATIONS)) {
    if (entry < name)
      await cp(join(MIGRATIONS, entry), join(copy, entry), {
        recursive: true,
      });
  }
  return copy;
}

async function migrated(migrationsFolder: string): Promise<void> {
  const { db, close } = createDatabase(url);
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await close();
  }
}

async function query<T>(text: string): Promise<T[]> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return (await client.query(text)).rows as T[];
  } finally {
    await client.end();
  }
}

async function pages(): Promise<Record<string, unknown[]>> {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(PAGE_QUERIES).map(
        async ([name, text]) => [name, await query(text)] as const,
      ),
    ),
  );
}

function settings(root: string, syncedFrom: string, read: boolean): string {
  return `('${root}', 'github', 'example-org/${root.split('/').at(-1) ?? ''}', '${syncedFrom}', null, null, '{"ready":"agent:ready"}', true, 'bug', ${String(read)}, ${String(read)}, ${String(read)}, ${String(read)})`;
}

function issue(root: string, number: number, title: string): string {
  return `('${root}', ${String(number)}, '${title}', 'open', '[]', 'https://git.example/${String(number)}', '${OLDER}', null, '${OLDER}')`;
}

function request(root: string, number: number, closes: number): string {
  return `('${root}', ${String(number)}, 'Request ${String(number)}', 'merged', false, 'feat/${String(number)}', 'https://git.example/pull/${String(number)}', '${OLDER}', '${LATEST}', null, '${LATEST}', '[${String(closes)}]', 'passing')`;
}

async function seedByRoot(): Promise<void> {
  await query(
    `insert into project (name, slug, remote, created_at) values
      ('Shop', 'shop', '${SHOP}', now()),
      ('Lib', 'lib', '${LIB}', now())`,
  );
  await query(
    `insert into root_remote (root, remote) values
      ('/work/shop', '${SHOP}'),
      ('/home/dev/shop', '${SHOP}'),
      ('/work/lib', '${LIB}'),
      ('/work/stray', '${STRAY}')`,
  );
  await query(
    `insert into git_host_project (project, git_host, repository, synced_from, error, error_git_host, stage_labels, auto_merge, bug_label, history_read, fix_read, state_events_read, body_closes_read) values
      ${[
        settings('/work/shop', LATEST, true),
        settings('/home/dev/shop', OLDER, false),
        settings('/work/lib', OLDER, true),
        settings('/work/stray', LATEST, true),
        settings('/work/no-remote', LATEST, true),
      ].join(',\n')}`,
  );
  await query(
    `insert into git_host_issue (project, number, title, state, labels, url, created_at, closed_at, updated_at) values
      ${[
        issue('/work/shop', 1, 'Export'),
        issue('/home/dev/shop', 1, 'Export, older copy'),
        issue('/home/dev/shop', 2, 'Older clone only'),
        issue('/work/lib', 5, 'Docs'),
        issue('/work/stray', 3, 'Stray'),
        issue('/work/no-remote', 4, 'Lost'),
      ].join(',\n')}`,
  );
  await query(
    `insert into git_host_request (project, number, title, state, draft, head_branch, url, created_at, merged_at, closed_at, updated_at, closes, checks) values
      ${[
        request('/work/shop', 10, 1),
        request('/home/dev/shop', 11, 2),
        request('/work/lib', 50, 5),
        request('/work/stray', 30, 3),
        request('/work/no-remote', 40, 4),
      ].join(',\n')}`,
  );
}

beforeAll(async () => {
  ({ url, drop } = await createScratchDatabase({ migrate: false }));
  folder = await migrationsBefore(FIRST_BY_REMOTE);
});

afterAll(async () => {
  await drop();
  await rm(folder, { recursive: true, force: true });
});

describe('the git host by remote migration', () => {
  it('moves the rows of each root to its remote, keeps the root collected last, and shows every page the same', async () => {
    await migrated(folder);
    await seedByRoot();
    const before = await pages();

    await migrated(MIGRATIONS);

    expect(await pages()).toEqual(before);
    expect(
      await query(
        `select remote, synced_from, history_read, fix_read, state_events_read, body_closes_read from git_host_project order by remote`,
      ),
    ).toEqual([
      {
        remote: SHOP,
        synced_from: new Date(LATEST),
        history_read: true,
        fix_read: true,
        state_events_read: true,
        body_closes_read: true,
      },
      expect.objectContaining({ remote: STRAY }),
      expect.objectContaining({ remote: LIB }),
    ]);
    expect(
      await query(
        `select remote, number, title from git_host_issue order by remote, number`,
      ),
    ).toEqual([
      { remote: SHOP, number: 1, title: 'Export' },
      { remote: STRAY, number: 3, title: 'Stray' },
      { remote: LIB, number: 5, title: 'Docs' },
    ]);
    expect(
      await query(
        `select remote, number from git_host_request order by remote, number`,
      ),
    ).toEqual([
      { remote: SHOP, number: 10 },
      { remote: STRAY, number: 30 },
      { remote: LIB, number: 50 },
    ]);

    await query(
      `insert into project (name, slug, remote, created_at) values ('Stray', 'stray', '${STRAY}', now())`,
    );
    expect(
      await query(`select project, number from project_issue order by number`),
    ).toEqual([
      { project: 'shop', number: 1 },
      { project: 'stray', number: 3 },
      { project: 'lib', number: 5 },
    ]);
  });
});
