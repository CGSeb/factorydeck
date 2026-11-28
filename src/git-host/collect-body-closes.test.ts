import { describe, expect, it } from 'vitest';
import { gitHostProject } from '../db/schema.ts';
import { hasFactory } from '../ingest/factory.ts';
import { T2, addProject, calls, remoteOfRoot } from '../test/git-host.ts';
import {
  closed,
  comment,
  githubData,
  merged,
  outcomeContext,
  serenity,
} from '../test/outcome.ts';
import { fakeCollection } from '../demo/fake-git-host-token.ts';
import { collect } from './collect.ts';

const ctx = outcomeContext();

describe('reading the closing keywords of requests already stored', () => {
  it('reads a project collected before the body was read once again in full and links the issue', async () => {
    const root = await addProject(
      ctx.db(),
      ctx.work(),
      'app',
      githubData(
        [closed(1)],
        [
          {
            ...merged(20, [], [comment(serenity(85))]),
            baseRefName: 'next',
            body: 'Closes #1',
          },
        ],
      ),
    );
    await ctx
      .db()
      .insert(gitHostProject)
      .values({
        remote: await remoteOfRoot(ctx.db(), root),
        gitHost: 'github',
        repository: 'example-org/example-app',
        syncedFrom: new Date(T2),
        stageLabels: {
          ready: 'agent:ready',
          working: 'agent:working',
          needs_spec: 'agent:needs-spec',
          review: 'agent:review',
          blocked: 'agent:blocked',
        },
        autoMerge: true,
        historyRead: true,
        fixRead: true,
        stateEventsRead: true,
      });
    await collect(ctx.db(), {
      ...(await fakeCollection()),
      hasFactory,
      now: () => new Date(T2),
    });
    const [first] = await calls(root);
    expect(first?.args.join(' ')).not.toContain('updated:');
    expect(await ctx.outcomeOf(root, 1)).toMatchObject({
      stage: 'merged',
      report: { score: 85 },
    });
    const [state] = await ctx
      .db()
      .select({ read: gitHostProject.bodyClosesRead })
      .from(gitHostProject);
    expect(state?.read).toBe(true);

    await collect(ctx.db(), {
      ...(await fakeCollection()),
      hasFactory,
      now: () => new Date(T2),
    });
    expect((await calls(root)).at(-1)?.args.join(' ')).toContain('updated:');
  });
});
