import { describe, expect, it } from 'vitest';
import type { FeatureRow } from '../features/types.ts';
import type { IssueOutcome } from '../git-host/types.ts';
import { APP, asBug, featureList, found, outcome } from './feature-fixtures.ts';
import { boardColumns } from './overview-board.ts';
import { splitTokens } from './token-fixtures.ts';

function row(
  number: number,
  stage: IssueOutcome['stage'],
  lastAt: string,
): FeatureRow {
  return {
    ...found(APP, number, `Issue ${String(number)}`),
    outcome: outcome(stage, null),
    lastAt,
    sessions: 1,
    apiCalls: 10,
    tokens: 1_000,
    tokenCounts: splitTokens(1_000),
    costUsd: 0.01,
    orchestrationCostUsd: null,
    roles: [],
  };
}

const ALL = { period: '7d' as const, project: undefined };
const NOW = new Date('2026-01-10T12:00:00.000Z');

describe('boardColumns with kinds', () => {
  it('puts a Bug badge before the other badges of a bug, none on a feature', () => {
    const rows = [
      asBug(row(1, 'needs-spec', '2026-01-09T12:00:00.000Z')),
      row(2, 'needs-spec', '2026-01-09T11:00:00.000Z'),
      asBug(row(3, 'working', '2026-01-09T10:00:00.000Z')),
    ];
    const [ready, working] = boardColumns(featureList(rows), ALL, NOW);
    expect(ready?.cards.map((card) => card.badge)).toEqual([
      [{ kind: 'bug' }, { kind: 'stage', stage: 'needs-spec' }],
      { kind: 'stage', stage: 'needs-spec' },
    ]);
    expect(working?.cards[0]?.badge).toEqual([{ kind: 'bug' }]);
  });

  it('carries the kind to the more link', () => {
    const rows = Array.from({ length: 7 }, (_, index) =>
      asBug(row(index + 1, 'working', '2026-01-09T12:00:00.000Z')),
    );
    const working = boardColumns(featureList(rows), ALL, NOW, 'bug')[1];
    expect(working?.more).toEqual({
      count: 2,
      href: '/features?period=7d&stage=working&kind=bug',
    });
    expect(boardColumns(featureList(rows), ALL, NOW)[1]?.more.href).toBe(
      '/features?period=7d&stage=working',
    );
  });
});
