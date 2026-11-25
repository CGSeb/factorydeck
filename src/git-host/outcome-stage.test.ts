import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gitHostProject } from '../db/schema.ts';
import { FACTORY_WORKFLOW, reopenedOnce } from '../demo/fake-git-host.ts';
import { hasFactory } from '../ingest/factory.ts';
import { T1, T2, addProject, calls, ghRequest } from '../test/git-host.ts';
import {
  closed,
  comment,
  githubData,
  labelled,
  merged,
  open,
  outcomeContext,
  serenity,
} from '../test/outcome.ts';
import { collect, collectSummary } from './collect.ts';

const ctx = outcomeContext();
const { collected, outcomeOf } = ctx;

describe('issue stage', () => {
  it('follows the rules in their order', async () => {
    const root = await collected(
      githubData(
        [
          closed(1, 'agent:blocked'),
          closed(2, 'agent:blocked'),
          labelled(3, 'agent:review', 'agent:blocked', 'agent:ready'),
          labelled(4, 'agent:ready', 'agent:needs-spec', 'agent:review'),
          labelled(5, 'agent:working', 'agent:review'),
          labelled(6, 'agent:ready', 'agent:working'),
          labelled(7, 'spec', 'agent:ready'),
          labelled(8, 'spec'),
          labelled(9, 'agent:review'),
        ],
        [merged(20, [1]), merged(21, [9]), open(22, [3])],
      ),
    );
    const stages = [];
    for (const number of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      stages.push((await outcomeOf(root, number))?.stage);
    }
    expect(stages).toEqual([
      'merged',
      'closed',
      'blocked',
      'needs-spec',
      'in-review',
      'working',
      'ready',
      'open',
      'merged',
    ]);
  });

  it('matches the configured labels whatever their case', async () => {
    const root = await collected(
      githubData([labelled(1, 'Agent:Blocked'), labelled(2, 'wip')], [], {
        factory: FACTORY_WORKFLOW.replace(
          'working: agent:working',
          'working: WIP',
        ),
      }),
    );
    expect(await outcomeOf(root, 1)).toMatchObject({ stage: 'blocked' });
    expect(await outcomeOf(root, 2)).toMatchObject({ stage: 'working' });
  });

  it('fails the project when a label key is missing, keeping its data', async () => {
    const root = await collected(githubData([labelled(1, 'agent:ready')], []));
    const file = join(root, 'docs', 'agents', 'factory.yml');
    const config = await readFile(file, 'utf8');
    await writeFile(file, config.replace('    review: agent:review\n', ''));
    const result = await collect(ctx.db(), { hasFactory });
    expect(collectSummary(result)).toEqual([
      'Collected 0 projects: 0 issues and 0 pull or merge requests updated.',
      'Could not read GitHub for app: docs/agents/factory.yml has no issues.labels.review.',
    ]);
    expect(await outcomeOf(root, 1)).toMatchObject({ stage: 'ready' });
  });
});

describe('reworked', () => {
  it('marks an issue closed by two requests or reopened', async () => {
    const root = await collected(
      githubData(
        [closed(1), closed(2), labelled(3)],
        [
          ghRequest(20, [1], [], { state: 'CLOSED', closedAt: T1 }),
          merged(21, [1]),
          merged(22, [2]),
          open(23, [3]),
        ],
        { stateEvents: reopenedOnce([2], T1, T1) },
      ),
    );
    expect(await outcomeOf(root, 1)).toMatchObject({ reworked: true });
    expect(await outcomeOf(root, 2)).toMatchObject({ reworked: true });
    expect(await outcomeOf(root, 3)).toMatchObject({ reworked: false });
  });
});

describe('upgrade', () => {
  it('reads everything again for a project collected before outcomes', async () => {
    const root = await addProject(
      ctx.db(),
      ctx.work(),
      'app',
      githubData([closed(1)], [merged(20, [1], [comment(serenity(85))])]),
    );
    await ctx
      .db()
      .insert(gitHostProject)
      .values({
        project: root,
        gitHost: 'github',
        repository: 'example-org/example-app',
        syncedFrom: new Date(T2),
      });
    await collect(ctx.db(), { hasFactory });
    const [first] = await calls(root);
    expect(first?.args.join(' ')).not.toContain('updated:');
    expect(await outcomeOf(root, 1)).toMatchObject({
      report: { score: 85 },
    });
  });
});
