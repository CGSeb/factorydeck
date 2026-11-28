import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import {
  gitHostIssue,
  gitHostRequest,
  project as projectTable,
  session,
} from '../db/schema.ts';
import {
  type FakeGitHostData,
  installFakeGitHost,
  writeFakeGitHostData,
} from '../demo/fake-git-host.ts';
import { hasFactory } from '../ingest/factory.ts';
import {
  addProject,
  calls,
  clock,
  ghIssue,
  ghRequest,
  github,
  success,
  T0,
  T1,
  T2,
} from '../test/git-host.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { fakeCollection, giveFakeToken } from '../demo/fake-git-host-token.ts';
import {
  type CollectOptions,
  type CollectResult,
  collect,
  collectSummary,
} from './collect.ts';
import { hostCliRunner } from '../team/host-cli.ts';
import { collectionStatus, issueDetail } from './query.ts';
import { lookupIssues } from './work-items.ts';

let db: Database;
let close: () => Promise<void>;
let work: string;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
  work = await realpath(await mkdtemp(join(tmpdir(), 'factorydeck-collect-')));
});

afterEach(async () => {
  await close();
  await rm(work, { recursive: true, force: true });
});

function project(name: string, data: FakeGitHostData): Promise<string> {
  return addProject(db, work, name, data);
}

async function collectAll(
  options: Partial<CollectOptions> = {},
): Promise<CollectResult> {
  return collect(db, { ...(await fakeCollection()), hasFactory, ...options });
}

describe('collect', () => {
  it('reads every issue and request of a GitHub repository on the first run', async () => {
    const root = await project('app', github());
    const result = await collectAll();
    expect(collectSummary(result)).toEqual([
      'Collected 1 projects: 2 issues and 3 pull or merge requests updated.',
    ]);
    const log = await calls(root);
    expect(log.every((call) => call.cwd === root)).toBe(true);
    expect(
      log.every(
        (call) =>
          call.args.includes('example-org/example-app') ||
          (call.args.includes('owner=example-org') &&
            call.args.includes('name=example-app')),
      ),
    ).toBe(true);
    expect(log.map((call) => call.args.join(' '))).toEqual([
      expect.stringContaining(
        'issue list --repo example-org/example-app --state all --limit 100 --search sort:updated-asc --json',
      ),
      expect.stringMatching(/^api graphql -f query=.*REOPENED_EVENT/s),
      expect.stringContaining(
        'pr list --repo example-org/example-app --state all --limit 100 --search sort:updated-asc --json',
      ),
    ]);
    const detail = await issueDetail(db, root, 1);
    expect(detail).toEqual({
      gitHost: 'github',
      number: 1,
      title: 'Issue 1',
      url: 'https://github.com/example-org/example-app/issues/1',
      state: 'open',
      labels: [
        { name: 'plain', color: null },
        { name: 'spec', color: '#1d76db' },
      ],
      requests: [
        {
          number: 4,
          title: 'Request 4',
          url: 'https://github.com/example-org/example-app/pull/4',
          state: 'open',
          draft: true,
          checks: 'pending',
          createdAt: new Date(T1).toISOString(),
        },
        expect.objectContaining({
          number: 3,
          state: 'merged',
          checks: 'passing',
        }),
      ],
      outcome: { stage: 'merged', report: null, reworked: true },
      milestones: [],
    });
    const [request] = await db
      .select()
      .from(gitHostRequest)
      .orderBy(gitHostRequest.number);
    expect(request).toMatchObject({
      headBranch: 'feat/3',
      mergedAt: new Date(T1),
      closes: [1],
      checks: 'passing',
    });
    const other = await issueDetail(db, root, 2);
    expect(other?.state).toBe('closed');
    expect(other?.requests).toEqual([
      expect.objectContaining({ number: 5, checks: 'none' }),
    ]);
  });

  it('then reads only what changed since the start of the last successful run', async () => {
    const root = await project('app', github());
    await collectAll({ now: clock('2026-03-03T08:00:00.500Z', T2) });
    await writeFakeGitHostData(root, {
      ...github(),
      issues: [
        ghIssue(1, '2026-03-04T00:00:00Z', { title: 'Renamed' }),
        ghIssue(2, T1),
      ],
      requests: [ghRequest(4, [1], [success], { createdAt: T1 })],
      log: join(root, 'calls.log'),
    });
    await rm(join(root, 'calls.log'));
    const result = await collectAll();
    expect(result).toMatchObject({ projects: 1, issues: 1, requests: 1 });
    const log = await calls(root);
    expect(log[0]?.args).toContain(
      'sort:updated-asc updated:>=2026-03-03T08:00:00+00:00',
    );
    expect(log.at(-1)?.args.slice(0, 3)).toEqual(['pr', 'view', '4']);
    const lookup = await lookupIssues(db, [{ project: root, number: 1 }]);
    expect(lookup({ project: root, number: 1 })).toEqual({
      status: 'found',
      title: 'Renamed',
      url: 'https://github.com/example-org/example-app/issues/1',
    });
    const [request] = await db
      .select()
      .from(gitHostRequest)
      .where(eq(gitHostRequest.number, 4));
    expect(request?.checks).toBe('passing');
  });

  it('pages through more than one page of results', async () => {
    const issues = Array.from({ length: 230 }, (_, index) =>
      ghIssue(
        index + 1,
        new Date(Date.parse(T0) + (index % 150) * 1000).toISOString(),
      ),
    );
    const root = await project('big', github({ issues, requests: [] }));
    const result = await collectAll();
    expect(result.issues).toBe(230);
    expect(
      (await calls(root)).filter((call) => call.args[0] === 'issue').length,
    ).toBeGreaterThan(2);
    expect(await db.$count(gitHostIssue)).toBe(230);
  });

  it('keeps a failed project and its data while the others are collected', async () => {
    const app = await project('app', github());
    await collectAll();
    await writeFakeGitHostData(app, {
      ...github(),
      fail: 'HTTP 401: Bad credentials (https://api.github.com/graphql)',
    });
    const api = await project('api', github());
    const result = await collectAll();
    expect(collectSummary(result)).toEqual([
      'Collected 1 projects: 2 issues and 3 pull or merge requests updated.',
      'Could not read GitHub for app: HTTP 401: Bad credentials (https://api.github.com/graphql).',
    ]);
    expect(await collectionStatus(db)).toMatchObject({
      failures: [
        {
          project: app,
          name: 'app',
          gitHost: 'github',
          reason: 'HTTP 401: Bad credentials (https://api.github.com/graphql)',
        },
      ],
    });
    expect((await issueDetail(db, app, 1))?.title).toBe('Issue 1');
    expect((await issueDetail(db, api, 1))?.title).toBe('Issue 1');
    await writeFakeGitHostData(app, github());
    await collectAll();
    expect((await collectionStatus(db)).failures).toEqual([]);
  });

  it('retries a failed run in full from the previous successful start', async () => {
    const app = await project('app', github());
    await collectAll({ now: clock('2026-03-03T08:00:00Z', T2) });
    await writeFakeGitHostData(app, {
      ...github(),
      fail: 'network is unreachable',
    });
    await collectAll({ now: clock('2026-03-04T08:00:00Z', T2) });
    await writeFakeGitHostData(app, {
      ...github(),
      log: join(app, 'calls.log'),
    });
    await rm(join(app, 'calls.log'));
    await collectAll();
    expect((await calls(app))[0]?.args).toContain(
      'sort:updated-asc updated:>=2026-03-03T08:00:00+00:00',
    );
  });

  it('reports a missing CLI and a CLI that does not answer', async () => {
    await project('app', github());
    const commands = { github: join(work, 'no-such-gh') };
    const missing = await collectAll({
      hostCli: { commands },
      runHostCli: hostCliRunner({ commands }),
    });
    expect(collectSummary(missing).slice(1)).toEqual([
      'Could not read GitHub for app: gh not found on the server.',
    ]);
    await project('slow', { ...github(), hang: true });
    const result = await collectAll({ timeoutMs: 1500 });
    expect(collectSummary(result).slice(1)).toEqual([
      expect.stringMatching(
        /^Could not read GitHub for slow: .*gh did not answer within 2 seconds\.$/,
      ),
    ]);
  });

  it('skips projects without the factory and unassigned sessions', async () => {
    await db
      .insert(session)
      .values([{ id: 'plain', project: join(work, 'plain') }, { id: 'none' }]);
    expect(await collectAll()).toEqual({
      projects: 0,
      issues: 0,
      requests: 0,
      failures: [],
    });
    expect((await collectionStatus(db)).collectedAt).not.toBeNull();
  });

  it('stops collecting a root once its remote belongs to no project', async () => {
    await project('app', github());
    await db
      .update(projectTable)
      .set({ remote: 'github.com/example-org/elsewhere' });

    expect(await collectAll()).toMatchObject({ projects: 0 });
    expect(await db.select().from(gitHostIssue)).toEqual([]);
  });

  it('starts over when the repository changes', async () => {
    const root = await project('app', github());
    await collectAll();
    await installFakeGitHost(root, {
      ...github(),
      repository: 'example-org/renamed',
      issues: [ghIssue(10, T1)],
      requests: [],
    });
    await giveFakeToken(db, root);
    await collectAll();
    const lookup = await lookupIssues(db, [
      { project: root, number: 1 },
      { project: root, number: 10 },
    ]);
    expect(lookup({ project: root, number: 1 })).toEqual({
      status: 'not-found',
    });
    expect(lookup({ project: root, number: 10 })).toMatchObject({
      status: 'found',
    });
  });
});
