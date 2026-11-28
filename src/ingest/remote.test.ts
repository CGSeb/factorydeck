import { execFile } from 'node:child_process';
import { mkdir, realpath, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { project, rootRemote } from '../db/schema.ts';
import { usageOverview } from '../overview/query.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  assistant,
  installFactory,
  sessionsFolder,
  userText,
  writeLog,
} from '../test/session-logs.ts';
import { ingest } from './ingest.ts';
import { readOriginRemote } from './remote.ts';

const git = promisify(execFile);
const NOW = new Date('2026-03-12T15:30:00Z');

let db: Database;
let close: () => Promise<void>;
let logs: string;
let work: string;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase({ linkRoots: false }));
  logs = await sessionsFolder();
  work = await realpath(await sessionsFolder());
});

afterEach(async () => {
  await close();
});

async function repository(folder: string, origin?: string): Promise<string> {
  const root = join(work, folder);
  await mkdir(root, { recursive: true });
  await git('git', ['init', '--quiet'], { cwd: root });
  if (origin !== undefined) {
    await git('git', ['remote', 'add', 'origin', origin], { cwd: root });
  }
  await installFactory(root);
  return root;
}

async function setOrigin(root: string, origin: string): Promise<void> {
  await git('git', ['remote', 'set-url', 'origin', origin], { cwd: root });
}

async function writeSession(id: string, cwd: string): Promise<void> {
  const ctx = { uuid: `${id}-0`, at: 0, cwd };
  await writeLog(join(logs, 'p', `${id}.jsonl`), [
    userText(ctx, 'Prompt'),
    assistant(ctx, { requestId: `${id}-req` }),
  ]);
}

async function remotes(): Promise<Record<string, string>> {
  const rows = await db.select().from(rootRemote);
  return Object.fromEntries(rows.map((row) => [row.root, row.remote]));
}

async function addProject(slug: string, remote: string): Promise<void> {
  await db.insert(project).values({ name: slug, slug, remote, createdAt: NOW });
}

async function projectSessions(): Promise<Record<string, number>> {
  const overview = await usageOverview(db, {
    period: 'all',
    timeZone: 'UTC',
    now: NOW,
  });
  return Object.fromEntries(
    overview.projects.map((row) => [row.project, row.sessions]),
  );
}

describe('readOriginRemote', () => {
  it('reads the origin of a repository in its normalised form', async () => {
    const root = await repository('shop', 'git@GitHub.com:Owner/Shop.git');
    expect(await readOriginRemote(root)).toBe('github.com/owner/shop');
  });

  it('reads no remote without origin, outside a repository or for a folder gone', async () => {
    expect(await readOriginRemote(await repository('bare'))).toBeUndefined();
    const plain = join(work, 'plain');
    await mkdir(plain);
    expect(await readOriginRemote(plain)).toBeUndefined();
    expect(await readOriginRemote(join(work, 'gone'))).toBeUndefined();
  });

  it('reads no remote for an origin that is not a remote of the accepted forms', async () => {
    const root = await repository('local', '/srv/git/shop.git');
    expect(await readOriginRemote(root)).toBeUndefined();
  });
});

describe('remotes recorded by the ingestion', () => {
  it('records the remote of each project root, an SSH and an HTTPS clone giving the same remote', async () => {
    const ssh = await repository('shop', 'git@github.com:owner/shop.git');
    const https = await repository(
      'shop-clone',
      'https://github.com/Owner/Shop',
    );
    await mkdir(join(ssh, 'src'));
    await writeSession('s1', join(ssh, 'src'));
    await writeSession('s2', https);
    await ingest(db, logs);

    expect(await remotes()).toEqual({
      [ssh]: 'github.com/owner/shop',
      [https]: 'github.com/owner/shop',
    });
    await addProject('shop', 'github.com/owner/shop');
    expect(await projectSessions()).toEqual({ shop: 2 });
  });

  it('records no remote for a root without origin, and hides its sessions', async () => {
    const root = await repository('bare');
    await writeSession('s1', root);
    await ingest(db, logs);

    expect(await remotes()).toEqual({});
    await addProject('bare', 'github.com/owner/bare');
    expect(await projectSessions()).toEqual({});
  });

  it('keeps the last remote of a root whose origin is removed or whose folder is gone', async () => {
    const root = await repository('shop', 'git@github.com:owner/shop.git');
    await writeSession('s1', root);
    await ingest(db, logs);
    await git('git', ['remote', 'remove', 'origin'], { cwd: root });
    await ingest(db, logs);
    expect(await remotes()).toEqual({ [root]: 'github.com/owner/shop' });

    await rm(root, { recursive: true, force: true });
    await ingest(db, logs);
    expect(await remotes()).toEqual({ [root]: 'github.com/owner/shop' });
  });

  it('moves every session of a root, past ones included, to its new origin at the next run', async () => {
    const root = await repository('shop', 'git@github.com:owner/shop.git');
    await addProject('shop', 'github.com/owner/shop');
    await addProject('store', 'github.com/owner/store');
    await writeSession('s1', root);
    await ingest(db, logs);
    expect(await projectSessions()).toEqual({ shop: 1 });

    await setOrigin(root, 'https://github.com/owner/store.git');
    await ingest(db, logs);
    expect(await remotes()).toEqual({ [root]: 'github.com/owner/store' });
    expect(await projectSessions()).toEqual({ store: 1 });
  });
});
