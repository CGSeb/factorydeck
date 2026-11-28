import { describe, expect, it } from 'vitest';
import type { FeatureRow } from '../features/types.ts';
import type { IssueOutcome } from '../git-host/types.ts';
import { APP, asBug, featureList, found, outcome } from './feature-fixtures.ts';
import { boardColumns, cardBadge } from './overview-board.ts';
import { splitTokens } from './token-fixtures.ts';

function inReview(number: number, report: IssueOutcome['report']): FeatureRow {
  return {
    ...found(APP, number, `Issue ${String(number)}`),
    outcome: { ...outcome('in-review', null), report },
    lastAt: '2026-01-01T00:00:00.000Z',
    sessions: 1,
    apiCalls: 10,
    tokens: 1_000,
    tokenCounts: splitTokens(1_000),
    costUsd: 0.01,
    orchestrationCostUsd: null,
    roles: [],
  };
}

function reportOf(
  score: number,
  rounds: number | null,
): IssueOutcome['report'] {
  return outcome('in-review', score, rounds).report;
}

describe('cardBadge in review', () => {
  it('shows the serenity then the review round when the report has rounds', () => {
    expect(cardBadge(inReview(1, reportOf(48, 3)))).toEqual([
      { kind: 'serenity', report: { score: 48, threshold: 80 } },
      { kind: 'rounds', rounds: 3, inReview: true },
    ]);
  });

  it('shows the serenity alone when the report has no rounds', () => {
    expect(cardBadge(inReview(1, reportOf(80, null)))).toEqual([
      { kind: 'serenity', report: { score: 80, threshold: 80 } },
    ]);
  });

  it('shows no badge without a report', () => {
    expect(cardBadge(inReview(1, null))).toBeUndefined();
  });

  it('shows the score path of a report with a first score', () => {
    const report = reportOf(84, 2);
    if (report === null) throw new Error('No report');
    expect(cardBadge(inReview(1, { ...report, firstScore: 62 }))).toEqual([
      {
        kind: 'serenity',
        report: { score: 84, threshold: 80, firstScore: 62 },
      },
      { kind: 'rounds', rounds: 2, inReview: true },
    ]);
  });

  it('puts the bug badge before the serenity and rounds badges', () => {
    const [, , review] = boardColumns(
      featureList([asBug(inReview(7, reportOf(48, 3)))]),
      { period: '7d', project: undefined },
      new Date('2026-01-10T12:00:00.000Z'),
    );
    expect(review?.cards[0]?.badge).toEqual([
      { kind: 'bug' },
      { kind: 'serenity', report: { score: 48, threshold: 80 } },
      { kind: 'rounds', rounds: 3, inReview: true },
    ]);
  });
});
