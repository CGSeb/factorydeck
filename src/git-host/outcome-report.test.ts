import { describe, expect, it } from 'vitest';
import { gitHostRequest } from '../db/schema.ts';
import {
  FACTORY_WORKFLOW,
  writeFakeGitHostData,
} from '../demo/fake-git-host.ts';
import { hasFactory } from '../ingest/factory.ts';
import { T1, T2, ghRequest } from '../test/git-host.ts';
import {
  type Row,
  closed,
  comment,
  githubData,
  labelled,
  merged,
  open,
  outcomeContext,
  serenity,
} from '../test/outcome.ts';
import { collect } from './collect.ts';

const ctx = outcomeContext();
const { collected, outcomeOf } = ctx;

describe('serenity report and merge', () => {
  it('counts a merged request whose report allowed the merge as merged', async () => {
    const root = await collected(
      githubData([closed(1)], [merged(20, [1], [comment(serenity(85))])]),
    );
    expect(await outcomeOf(root, 1)).toEqual({
      stage: 'merged',
      report: { score: 85, threshold: 80, rounds: 2 },
      reworked: false,
    });
  });

  it('counts each reason a report refused the merge as merged by a person', async () => {
    const root = await collected(
      githubData(
        [closed(1), closed(2), closed(3)],
        [
          merged(20, [1], [comment(serenity(57))]),
          merged(21, [2], [comment(serenity(90, 80, 'Gates: one failed.'))]),
          merged(22, [3], [comment(serenity(80, 80))]),
        ],
      ),
    );
    expect(await outcomeOf(root, 1)).toMatchObject({
      stage: 'merged-by-person',
      report: { score: 57, threshold: 80 },
    });
    expect(await outcomeOf(root, 2)).toMatchObject({
      stage: 'merged-by-person',
    });
    expect(await outcomeOf(root, 3)).toMatchObject({ stage: 'merged' });
  });

  it('counts every merge with a report as merged by a person when auto-merge is off', async () => {
    const root = await collected(
      githubData(
        [closed(1), closed(2)],
        [merged(20, [1], [comment(serenity(95))]), merged(21, [2])],
        {
          factory: FACTORY_WORKFLOW.replace(
            'auto_merge: true',
            'auto_merge: false',
          ),
        },
      ),
    );
    expect(await outcomeOf(root, 1)).toMatchObject({
      stage: 'merged-by-person',
    });
    expect(await outcomeOf(root, 2)).toMatchObject({
      stage: 'merged',
      report: null,
    });
  });

  it('takes the latest report of the merged request, then of the most recently updated open one', async () => {
    const root = await collected(
      githubData(
        [closed(1), labelled(2, 'agent:review'), labelled(3)],
        [
          merged(
            20,
            [1],
            [
              comment(serenity(90), '2026-03-02T12:00:00Z'),
              comment(serenity(40), '2026-03-02T09:00:00Z'),
            ],
          ),
          open(21, [1], [comment(serenity(10))]),
          open(22, [2], [comment(serenity(60))], '2026-03-03T10:00:00Z'),
          open(23, [2], [comment(serenity(30))], T1),
          ghRequest(24, [3], [], {
            state: 'CLOSED',
            closedAt: T1,
            comments: [comment(serenity(70))],
          }),
        ],
      ),
    );
    expect(await outcomeOf(root, 1)).toMatchObject({
      stage: 'merged-after-person',
      report: { score: 90 },
    });
    expect(await outcomeOf(root, 2)).toEqual({
      stage: 'in-review',
      report: { score: 60, threshold: 80, rounds: 2 },
      reworked: true,
    });
    expect(await outcomeOf(root, 3)).toMatchObject({ report: null });
  });

  it('stores only the parsed report, not the comment text', async () => {
    await collected(
      githubData(
        [closed(1)],
        [
          merged(
            20,
            [1],
            [comment('Thanks, merging.'), comment(serenity(85), T2)],
          ),
        ],
      ),
    );
    const rows = await ctx.db().select().from(gitHostRequest);
    expect(rows.map((row) => row.report)).toEqual([
      {
        score: 85,
        threshold: 80,
        rounds: 2,
        gatesPassed: true,
        at: new Date(T2).toISOString(),
      },
    ]);
    expect(JSON.stringify(rows)).not.toContain('a note');
  });

  it('refreshes the stage and the report at the next collection', async () => {
    const root = await collected(
      githubData([labelled(1, 'agent:working')], [open(20, [1])]),
      new Date(T1),
    );
    expect(await outcomeOf(root, 1)).toMatchObject({
      stage: 'working',
      report: null,
    });
    await writeFakeGitHostData(
      root,
      githubData(
        [{ ...labelled(1, 'agent:review'), updatedAt: T2 }],
        [open(20, [1], [comment(serenity(72), T2)], T2)],
      ),
    );
    await collect(ctx.db(), { hasFactory, now: () => new Date(T2) });
    expect(await outcomeOf(root, 1)).toMatchObject({
      stage: 'in-review',
      report: { score: 72 },
    });
  });

  it('counts an issue closed by the body of a request merged into another branch as merged', async () => {
    const intoNext = (number: number, issue: number): Row => ({
      ...merged(number, [], [comment(serenity(85))]),
      baseRefName: 'next',
      body: `Closes #${String(issue)}`,
    });
    const root = await collected(
      githubData([closed(1), labelled(2)], [intoNext(20, 1), intoNext(21, 2)]),
    );
    for (const issue of [1, 2]) {
      expect(await outcomeOf(root, issue)).toMatchObject({
        stage: 'merged',
        report: { score: 85 },
      });
    }
  });
});
