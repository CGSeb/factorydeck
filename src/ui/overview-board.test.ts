import { describe, expect, it } from 'vitest';
import type { FeatureRow } from '../features/types.ts';
import type { IssueOutcome } from '../git-host/types.ts';
import { boardFeatures } from './feature-board-fixtures.ts';
import { APP, LIB, featureList, found, outcome } from './feature-fixtures.ts';
import {
  boardColumns,
  cardBadge,
  headlineCount,
  headlineSummary,
  listPath,
  roleSegments,
  tokenBuckets,
} from './overview-board.ts';
import { roleList, someRoles } from './role-fixtures.ts';
import { splitTokens } from './token-fixtures.ts';
import { weekOverview } from './fixtures.ts';

function row(
  number: number,
  stage: IssueOutcome['stage'] | null,
  lastAt: string | null,
  extra: Partial<FeatureRow> = {},
): FeatureRow {
  return {
    ...found(APP, number, `Issue ${String(number)}`),
    outcome: stage === null ? null : outcome(stage, null),
    lastAt,
    sessions: 1,
    apiCalls: 10,
    tokens: 1_000,
    tokenCounts: splitTokens(1_000),
    costUsd: 0.01,
    orchestrationCostUsd: null,
    roles: [],
    ...extra,
  };
}

const ALL = { period: '7d' as const, project: undefined };
const NOW = new Date('2026-01-10T12:00:00.000Z');

describe('boardColumns', () => {
  it('groups the stages into the four columns and leaves the others out', () => {
    const columns = boardColumns(featureList(boardFeatures), ALL, NOW);
    expect(columns.map((column) => column.group)).toEqual([
      'ready',
      'working',
      'in-review',
      'merged',
    ]);
    expect(
      columns.map((column) => column.cards.map((card) => card.issue.number)),
    ).toEqual([
      [63, 64],
      [57, 58],
      [61, 60],
      [45, 52, 48],
    ]);
    expect(columns.map((column) => column.count)).toEqual([2, 2, 2, 3]);
  });

  it('puts open, needs-spec, ready and blocked in Ready, and both merges in Merged', () => {
    const stages: IssueOutcome['stage'][] = [
      'open',
      'needs-spec',
      'ready',
      'blocked',
      'working',
      'in-review',
      'merged',
      'merged-by-person',
      'closed',
    ];
    const rows = stages.map((stage, index) =>
      row(index + 1, stage, '2026-01-01T00:00:00.000Z'),
    );
    const counts = boardColumns(featureList(rows), ALL, NOW).map(
      (column) => column.count,
    );
    expect(counts).toEqual([4, 1, 1, 2]);
  });

  it('counts every issue of a column, shown or not, with no tokens', () => {
    const rows = Array.from({ length: 7 }, (_, index) =>
      row(index + 1, 'working', `2026-01-0${String(index + 1)}T00:00:00.000Z`),
    );
    const working = boardColumns(featureList(rows), ALL, NOW)[1];
    expect(working?.count).toBe(7);
    expect(working).not.toHaveProperty('counts');
    expect(working?.cards[0]).not.toHaveProperty('counts');
  });

  it('shows the time of the last activity on a card, and none without a call', () => {
    const rows = [
      row(1, 'working', '2026-01-10T11:58:00.000Z'),
      row(2, 'working', null),
    ];
    const cards = boardColumns(featureList(rows), ALL, NOW)[1]?.cards;
    expect(cards?.[0]?.activity).toEqual({
      at: '2026-01-10T11:58:00.000Z',
      text: '2 min ago',
    });
    expect(cards?.[1]?.activity).toBeUndefined();
  });

  it('shows the 5 latest issues, ties broken by the highest number, and counts the rest', () => {
    const rows = [
      row(1, 'working', '2026-01-01T00:00:00.000Z'),
      row(2, 'working', '2026-01-05T00:00:00.000Z'),
      row(3, 'working', '2026-01-05T00:00:00.000Z'),
      row(4, 'working', '2026-01-03T00:00:00.000Z'),
      row(5, 'working', '2026-01-02T00:00:00.000Z'),
      row(6, 'working', null),
      row(7, 'working', '2026-01-04T00:00:00.000Z'),
    ];
    const working = boardColumns(featureList(rows), ALL, NOW)[1];
    expect(working?.cards.map((card) => card.issue.number)).toEqual([
      3, 2, 7, 4, 5,
    ]);
    expect(working?.more).toEqual({
      count: 2,
      href: '/features?period=7d&stage=working',
    });
  });

  it('shows no more link with 5 issues or fewer', () => {
    const rows = Array.from({ length: 5 }, (_, index) =>
      row(index + 1, 'merged', '2026-01-01T00:00:00.000Z'),
    );
    expect(boardColumns(featureList(rows), ALL, NOW)[3]?.more.count).toBe(0);
  });

  it('keeps the project and period in the links, and hides the project with one selected', () => {
    const filters = { period: '30d' as const, project: LIB };
    const columns = boardColumns(
      featureList(boardFeatures.filter((r) => r.project === LIB)),
      filters,
      NOW,
    );
    const card = columns[1]?.cards[0];
    expect(card?.showProject).toBe(false);
    expect(card?.issue.href).toBe(
      `/features/58?project=${encodeURIComponent(LIB)}&period=30d`,
    );
    expect(columns[1]?.more.href).toBe(
      `/features?period=30d&project=${encodeURIComponent(LIB)}&stage=working`,
    );
  });

  it('shows the project with all projects, coloured in the order of the projects', () => {
    const columns = boardColumns(featureList(boardFeatures), ALL, NOW);
    const cards = columns.flatMap((column) => column.cards);
    const app = cards.find((card) => card.issue.project === APP);
    const lib = cards.find((card) => card.issue.project === LIB);
    expect(app?.showProject).toBe(true);
    expect(app?.issue.projectColor).not.toBe(lib?.issue.projectColor);
  });
});

describe('cardBadge', () => {
  const at = '2026-01-01T00:00:00.000Z';

  it('shows the stage in Ready unless it is Ready', () => {
    expect(cardBadge(row(1, 'ready', at))).toBeUndefined();
    expect(cardBadge(row(1, 'open', at))).toEqual({
      kind: 'stage',
      stage: 'open',
    });
    expect(cardBadge(row(1, 'needs-spec', at))).toEqual({
      kind: 'stage',
      stage: 'needs-spec',
    });
    expect(cardBadge(row(1, 'blocked', at))).toEqual({
      kind: 'stage',
      stage: 'blocked',
    });
  });

  it('shows no badge in Working', () => {
    expect(cardBadge(row(1, 'working', at))).toBeUndefined();
  });

  it('shows the serenity of a merge, and adds by a person for a merge by a person', () => {
    expect(
      cardBadge(row(1, 'merged', at, { outcome: outcome('merged', 86, 1) })),
    ).toEqual([{ kind: 'serenity', report: { score: 86, threshold: 80 } }]);
    expect(cardBadge(row(1, 'merged', at))).toBeUndefined();
    expect(
      cardBadge(
        row(1, 'merged-by-person', at, {
          outcome: outcome('merged-by-person', 70, 3),
        }),
      ),
    ).toEqual([
      { kind: 'serenity', report: { score: 70, threshold: 80 } },
      { kind: 'text', text: 'by a person' },
    ]);
    expect(cardBadge(row(1, 'merged-by-person', at))).toEqual([
      { kind: 'text', text: 'by a person' },
    ]);
  });

  it('gives the card the score path of the request that counts', () => {
    const merged = outcome('merged-after-person', 88, 2);
    expect(
      cardBadge(
        row(1, 'merged-after-person', at, {
          outcome: {
            ...merged,
            report:
              merged.report === null
                ? null
                : { ...merged.report, firstScore: 64 },
          },
        }),
      ),
    ).toEqual([
      {
        kind: 'serenity',
        report: { score: 88, threshold: 80, firstScore: 64 },
      },
      { kind: 'text', text: 'after a person' },
    ]);
  });

  it('adds after a person to a merge a person helped', () => {
    expect(
      cardBadge(
        row(1, 'merged-after-person', at, {
          outcome: outcome('merged-after-person', 88, 2),
        }),
      ),
    ).toEqual([
      { kind: 'serenity', report: { score: 88, threshold: 80 } },
      { kind: 'text', text: 'after a person' },
    ]);
    expect(cardBadge(row(1, 'merged-after-person', at))).toEqual([
      { kind: 'text', text: 'after a person' },
    ]);
  });
});

describe('headline', () => {
  it('names the merged issues', () => {
    expect(headlineCount(0)).toBe('No issue merged · ');
    expect(headlineCount(1)).toBe('1 issue merged for ');
    expect(headlineCount(12)).toBe('12 issues merged for ');
  });

  it('summarises the median tokens per merged issue and the sessions', () => {
    expect(headlineSummary({ value: 2_400_000, n: 5 }, 14)).toBe(
      '2.4M tokens per merged issue · 14 sessions',
    );
  });

  it('leaves the tokens per merged issue out below 5 merged issues with agent work', () => {
    expect(headlineSummary({ value: 2_400_000, n: 4 }, 1)).toBe('1 session');
    expect(headlineSummary({ value: null, n: 0 }, 0)).toBe('0 sessions');
    expect(headlineSummary(undefined, 3)).toBe('3 sessions');
  });
});

describe('panel', () => {
  it('builds the role split, largest first, with token counts', () => {
    const segments = roleSegments(roleList(someRoles));
    const values = segments.map((segment) => segment.value);
    expect(values).toEqual([...values].sort((a, b) => b - a));
    expect(segments.every((segment) => segment.counts !== undefined)).toBe(
      true,
    );
  });

  it('turns the overview series into token buckets', () => {
    const buckets = tokenBuckets(weekOverview.series);
    expect(buckets).toHaveLength(weekOverview.series.length);
    expect(buckets[0]?.costUsd).toBeCloseTo(6.1 + 1.2 + 0.05);
  });

  it('keeps the period and project in list links', () => {
    expect(listPath('/roles', ALL)).toBe('/roles?period=7d');
    expect(listPath('/roles', { period: 'today', project: APP })).toBe(
      `/roles?period=today&project=${encodeURIComponent(APP)}`,
    );
  });
});
