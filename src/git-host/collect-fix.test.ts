import { describe, expect, it } from 'vitest';
import { gitHostProject, gitHostRequest } from '../db/schema.ts';
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

const FIX_REPORT = `${serenity(88)}Root cause: the export reads an empty list.\nReproduced: failed on main\n`;

describe('reading the fix lines of reports already stored', () => {
  it('reads a project collected before the fix lines once again in full', async () => {
    const root = await addProject(
      ctx.db(),
      ctx.work(),
      'app',
      githubData([closed(1, 'bug')], [merged(20, [1], [comment(FIX_REPORT)])]),
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
      });
    await collect(ctx.db(), {
      ...(await fakeCollection()),
      hasFactory,
      now: () => new Date(T2),
    });
    const [first] = await calls(root);
    expect(first?.args.join(' ')).not.toContain('updated:');
    const [request] = await ctx.db().select().from(gitHostRequest);
    expect(request?.report).toMatchObject({
      rootCause: 'the export reads an empty list.',
      reproduced: 'failed-on-main',
    });
    const [state] = await ctx
      .db()
      .select({ fixRead: gitHostProject.fixRead })
      .from(gitHostProject);
    expect(state?.fixRead).toBe(true);

    await collect(ctx.db(), {
      ...(await fakeCollection()),
      hasFactory,
      now: () => new Date(T2),
    });
    const later = await calls(root);
    expect(later.at(-1)?.args.join(' ')).toContain('updated:');
  });
});
