import { describe, expect, it } from 'vitest';
import { T0, T1, ghRequest } from '../test/git-host.ts';
import {
  type Row,
  closed,
  comment,
  githubData,
  merged,
  outcomeContext,
  serenity,
} from '../test/outcome.ts';
import { issueDetail } from './query.ts';

const ctx = outcomeContext();

const BEFORE = '2026-03-02T08:00:00Z';

function labeled(createdAt: string, added = true): Row {
  return {
    __typename: added ? 'LabeledEvent' : 'UnlabeledEvent',
    createdAt,
    label: { name: 'agent:needs-spec' },
  };
}

describe('issue milestones', () => {
  it('gives the reports of every closing request and the needs-spec episodes', async () => {
    const root = await ctx.collected(
      githubData(
        [closed(1)],
        [
          ghRequest(21, [1], [], {
            state: 'CLOSED',
            closedAt: T0,
            comments: [comment(serenity(90, 80, 'Gates: one failed.'), T0)],
          }),
          merged(
            22,
            [1],
            [comment(serenity(64), BEFORE), comment(serenity(88), T1)],
          ),
        ],
        { labelEvents: { '1': [labeled(T0), labeled(BEFORE, false)] } },
      ),
    );
    const detail = await issueDetail(ctx.db(), root, 1);
    expect(detail?.milestones).toEqual([
      {
        kind: 'report',
        at: '2026-03-01T10:00:00.000Z',
        request: {
          number: 21,
          url: 'https://github.com/example-org/example-app/pull/21',
        },
        score: 90,
        threshold: 80,
        refused: true,
        reasons: ['gates-failed'],
      },
      {
        kind: 'needs-spec',
        at: '2026-03-01T10:00:00.000Z',
        removedAt: '2026-03-02T08:00:00.000Z',
      },
      expect.objectContaining({
        kind: 'report',
        score: 64,
        refused: true,
        reasons: ['below-threshold'],
      }),
      expect.objectContaining({ kind: 'report', score: 88, refused: false }),
    ]);
    expect(detail?.outcome.report).toEqual({
      score: 88,
      threshold: 80,
      rounds: 2,
      firstScore: 64,
    });
  });
});
