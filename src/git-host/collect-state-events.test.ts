import { describe, expect, it } from 'vitest';
import { gitHostIssue, gitHostProject } from '../db/schema.ts';
import { reopenedOnce } from '../demo/fake-git-host.ts';
import { hasFactory } from '../ingest/factory.ts';
import { T1, T2, addProject, calls, ghIssue } from '../test/git-host.ts';
import { githubData, outcomeContext } from '../test/outcome.ts';
import { collect } from './collect.ts';

const ctx = outcomeContext();

describe('reading the close and reopen events of issues already stored', () => {
  it('reads a project collected before the events once again in full', async () => {
    const root = await addProject(
      ctx.db(),
      ctx.work(),
      'app',
      githubData([ghIssue(1, T1)], [], {
        stateEvents: reopenedOnce([1], '2026-03-01T12:00:00Z', T1),
      }),
    );
    await ctx
      .db()
      .insert(gitHostProject)
      .values({
        project: root,
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
      });
    await collect(ctx.db(), { hasFactory, now: () => new Date(T2) });
    const [first] = await calls(root);
    expect(first?.args.join(' ')).not.toContain('updated:');
    const [issue] = await ctx.db().select().from(gitHostIssue);
    expect(issue).toMatchObject({
      reopened: true,
      stateEvents: [
        { state: 'closed', at: '2026-03-01T12:00:00.000Z' },
        { state: 'reopened', at: new Date(T1).toISOString() },
      ],
    });
    const [state] = await ctx
      .db()
      .select({ read: gitHostProject.stateEventsRead })
      .from(gitHostProject);
    expect(state?.read).toBe(true);

    await collect(ctx.db(), { hasFactory, now: () => new Date(T2) });
    expect((await calls(root)).at(-1)?.args.join(' ')).toContain('updated:');
  });
});
