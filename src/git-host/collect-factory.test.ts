import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  gitHostIssue,
  gitHostProject,
  project as projectTable,
  rootRemote,
  session,
} from '../db/schema.ts';
import {
  FACTORY_WORKFLOW,
  installFakeGitHost,
  writeFakeGitHostData,
} from '../demo/fake-git-host.ts';
import {
  FAKE_SECRET_KEY,
  fakeCollection,
} from '../demo/fake-git-host-token.ts';
import { hasFactory } from '../ingest/factory.ts';
import { encryptToken, secretKey } from '../team/token-cipher.ts';
import { addProject, calls, hostCalls } from '../test/git-host.ts';
import { githubData, labelled, outcomeContext } from '../test/outcome.ts';
import { collect, collectSummary } from './collect.ts';
import { collectionStatus } from './query.ts';

const ctx = outcomeContext();
const { outcomeOf } = ctx;

function remoteWorkflow(gitHost: string, working: string): string {
  return `version: 2\nrepository:\n  git_host: ${gitHost}\n${FACTORY_WORKFLOW.replace(
    'working: agent:working',
    `working: ${working}`,
  )}`;
}

function run(extra: Partial<Parameters<typeof collect>[1]> = {}) {
  return (async () =>
    collect(ctx.db(), {
      ...(await fakeCollection()),
      hasFactory,
      ...extra,
    }))();
}

async function app(working = 'wip') {
  const data = {
    ...githubData([labelled(1, 'wip'), labelled(2, 'doing')], []),
    remoteFactory: remoteWorkflow('github', working),
  };
  const root = await addProject(ctx.db(), ctx.work(), 'app', data);
  return { root, data };
}

describe('factory settings read through the git host', () => {
  it('takes the labels from factory.yml on the default branch, not from the disk, and follows a change at the next run', async () => {
    const { root, data } = await app();
    expect((await run()).failures).toEqual([]);
    expect(await outcomeOf(root, 1)).toMatchObject({ stage: 'working' });
    expect(await outcomeOf(root, 2)).toMatchObject({ stage: 'open' });
    const host = await hostCalls(root);
    expect(host.map((call) => call.args.at(-1))).toEqual([
      'repos/example-org/example-app',
      'repos/example-org/example-app/contents/docs/agents/factory.yml?ref=main',
    ]);
    expect(host.every((call) => call.cwd !== root)).toBe(true);
    expect(host[0]?.args.slice(0, 2)).toEqual(['api', '--hostname']);

    await writeFakeGitHostData(root, {
      ...data,
      remoteFactory: remoteWorkflow('github', 'doing'),
    });
    expect((await run()).failures).toEqual([]);
    expect(await outcomeOf(root, 1)).toMatchObject({ stage: 'open' });
    expect(await outcomeOf(root, 2)).toMatchObject({ stage: 'working' });
  });

  it('fails the project on a git host mismatch, keeping its data and settings', async () => {
    const { root, data } = await app();
    await run();
    await writeFakeGitHostData(root, {
      ...data,
      remoteFactory: remoteWorkflow('GitLab', 'doing'),
    });
    const result = await run();
    expect(collectSummary(result).slice(1)).toEqual([
      'Could not read GitHub for app: factory.yml says GitLab, the remote is on github.',
    ]);
    expect((await collectionStatus(ctx.db(), hasFactory)).failures).toEqual([
      {
        project: root,
        name: 'app',
        gitHost: 'github',
        reason: 'factory.yml says GitLab, the remote is on github',
      },
    ]);
    expect(await outcomeOf(root, 1)).toMatchObject({ stage: 'working' });
    expect(await outcomeOf(root, 2)).toMatchObject({ stage: 'open' });
  });

  it('reports a missing secret key, a token it cannot decrypt and a bad token without collecting', async () => {
    const { root } = await app();
    await run();
    const issues = await ctx.db().select().from(gitHostIssue);
    const collected = (await calls(root)).length;
    const reasons = async (extra = {}) =>
      (await run(extra)).failures.map((failure) => failure.reason);

    expect(await reasons({ secretKey: secretKey(undefined) })).toEqual([
      'No secret key: set FACTORYDECK_SECRET_KEY',
    ]);
    expect(
      await reasons({
        secretKey: secretKey(Buffer.alloc(32, 1).toString('base64')),
      }),
    ).toEqual(['Token cannot be decrypted: set it again']);
    await ctx
      .db()
      .update(projectTable)
      .set({
        tokenCiphertext: encryptToken(
          Buffer.from(FAKE_SECRET_KEY, 'base64'),
          await projectId(root),
          'not-a-token',
        ),
      });
    expect(await reasons()).toEqual(['Bad token']);
    expect(await calls(root)).toHaveLength(collected);
    expect(await ctx.db().select().from(gitHostIssue)).toEqual(issues);
  });

  it('collects only projects with a token, keeping the data of one whose token was removed', async () => {
    const { root } = await app();
    await run();
    const issues = await ctx.db().select().from(gitHostIssue);
    await ctx.db().update(projectTable).set({ tokenCiphertext: null });
    expect(await run()).toMatchObject({ projects: 0, failures: [] });
    expect(await ctx.db().select().from(gitHostIssue)).toEqual(issues);
    expect(await hostCalls(root)).toHaveLength(2);
  });

  it('reads factory.yml once per run for a project with several roots', async () => {
    const { root, data } = await app();
    const other = join(ctx.work(), 'other');
    await installFakeGitHost(other, { ...data, log: join(other, 'calls.log') });
    await ctx
      .db()
      .insert(session)
      .values({ id: 'session-other', project: other });
    const [linked] = await ctx
      .db()
      .select({ remote: projectTable.remote })
      .from(projectTable)
      .where(eq(projectTable.slug, root));
    await ctx
      .db()
      .update(rootRemote)
      .set({ remote: linked?.remote ?? '' })
      .where(eq(rootRemote.root, other));
    const result = await run();
    expect(result).toMatchObject({ projects: 2, failures: [] });
    expect(await hostCalls(root)).toHaveLength(2);
    expect(await hostCalls(other)).toHaveLength(0);
    expect((await calls(other)).length).toBeGreaterThan(0);
  });

  it('stores the normalised remote in lower case as the repository, reading in full once a project stored another form', async () => {
    const { root } = await app();
    await run();
    const stored = async () =>
      (await ctx.db().select().from(gitHostProject))[0]?.repository;
    expect(await stored()).toBe(await remoteOf(root));
    expect(await stored()).toMatch(/^[a-z0-9.-]+\/example-org\/example-app$/);
    await ctx
      .db()
      .update(gitHostProject)
      .set({ repository: 'Example-Org/Example-App' });
    await run();
    const issueLists = (await calls(root)).filter(
      (call) => call.args[0] === 'issue',
    );
    expect(issueLists).toHaveLength(2);
    expect(issueLists[1]?.args.join(' ')).not.toContain('updated:');
    expect(await stored()).toBe(await remoteOf(root));
  });
});

async function projectId(root: string): Promise<number> {
  const [row] = await ctx
    .db()
    .select({ id: projectTable.id })
    .from(projectTable)
    .where(eq(projectTable.slug, root));
  if (row === undefined) throw new Error(`No project ${root}`);
  return row.id;
}

async function remoteOf(root: string): Promise<string> {
  const [row] = await ctx
    .db()
    .select({ remote: projectTable.remote })
    .from(projectTable)
    .where(eq(projectTable.slug, root));
  return row?.remote ?? '';
}
