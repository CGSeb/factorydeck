import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import {
  gitHostIssue,
  gitHostProject,
  project,
  rootRemote,
  session,
} from '../db/schema.ts';
import { writeFakeGitHostData } from '../demo/fake-git-host.ts';
import { fakeCollection } from '../demo/fake-git-host-token.ts';
import { hasFactory } from '../ingest/factory.ts';
import { addProject, calls, github } from '../test/git-host.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { type CollectResult, collect } from './collect.ts';
import { collectionStatus, issueDetail } from './query.ts';

let db: Database;
let close: () => Promise<void>;
let work: string;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
  work = await realpath(await mkdtemp(join(tmpdir(), 'factorydeck-remote-')));
});

afterEach(async () => {
  await close();
  await rm(work, { recursive: true, force: true });
});

async function collectAll(): Promise<CollectResult> {
  return collect(db, { ...(await fakeCollection()), hasFactory });
}

async function remoteOf(slug: string): Promise<string> {
  const [found] = await db
    .select({ remote: project.remote })
    .from(project)
    .where(eq(project.slug, slug));
  if (found === undefined) throw new Error(`No project ${slug}`);
  return found.remote;
}

async function cloneOf(app: string, name: string): Promise<string> {
  const clone = await addProject(db, work, name, github());
  await db
    .update(rootRemote)
    .set({ remote: await remoteOf(app) })
    .where(eq(rootRemote.root, clone));
  await db.delete(project).where(eq(project.slug, clone));
  return clone;
}

describe('git host data by remote', () => {
  it('stores the data of a root under its remote, read once for two roots of one remote', async () => {
    const app = await addProject(db, work, 'app', github());
    const clone = await cloneOf(app, 'clone');
    await db
      .update(session)
      .set({ lastAt: new Date('2026-03-04T10:00:00Z') })
      .where(eq(session.project, clone));

    const result = await collectAll();

    expect(result).toMatchObject({ projects: 1, failures: [] });
    expect(await calls(app)).toEqual([]);
    expect((await calls(clone)).length).toBeGreaterThan(0);
    expect(
      (await db.select({ remote: gitHostProject.remote }).from(gitHostProject))
        .map((row) => row.remote)
        .sort(),
    ).toEqual([await remoteOf(app)]);
    expect(
      new Set(
        (
          await db.select({ remote: gitHostIssue.remote }).from(gitHostIssue)
        ).map((row) => row.remote),
      ),
    ).toEqual(new Set([await remoteOf(app)]));
    expect((await issueDetail(db, app, 1))?.title).toBe('Issue 1');
  });

  it("drops a failure line once the project's remote changes", async () => {
    const app = await addProject(db, work, 'app', github());
    await writeFakeGitHostData(app, { ...github(), fail: 'HTTP 401' });
    await collectAll();
    expect((await collectionStatus(db)).failures).toMatchObject([
      { project: app, reason: 'HTTP 401' },
    ]);

    const moved = 'github.com/example-org/moved';
    await db
      .update(project)
      .set({ remote: moved })
      .where(eq(project.slug, app));

    expect((await collectionStatus(db)).failures).toEqual([]);
  });

  it('shows the git host data of a project whose root has no factory file left', async () => {
    const app = await addProject(db, work, 'app', github());
    await collectAll();
    await rm(join(app, 'docs'), { recursive: true, force: true });

    expect(await hasFactory(app)).toBe(false);
    expect((await issueDetail(db, app, 1))?.title).toBe('Issue 1');
  });
});
