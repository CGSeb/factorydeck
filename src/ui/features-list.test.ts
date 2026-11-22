import { describe, expect, it } from 'vitest';
import type { FeatureRow } from '../features/types.ts';
import { ORCHESTRATION_COLOR } from './design/palette.ts';
import { boardFeatures } from './feature-board-fixtures.ts';
import {
  type FeatureSortKey,
  featureSortOf,
  groupOf,
  groupRows,
  rowRoleColors,
  sortRows,
  stageItems,
  stageOf,
  summaryText,
  withListParams,
} from './features-list.ts';

function labels(rows: readonly FeatureRow[]): string[] {
  return rows.map((row) => `#${String(row.number)}`);
}

function at(number: number): FeatureRow {
  const row = boardFeatures.find((candidate) => candidate.number === number);
  if (row === undefined) throw new Error(`No row #${String(number)}`);
  return row;
}

describe('stageOf', () => {
  it.each([
    ['stage=ready', 'ready'],
    ['stage=working', 'working'],
    ['stage=in-review', 'in-review'],
    ['stage=merged', 'merged'],
    ['stage=merged&stage=ready', 'merged'],
    ['stage=ready&stage=bogus', 'ready'],
  ])('reads %s', (search, expected) => {
    expect(stageOf(new URLSearchParams(search))).toBe(expected);
  });

  it.each([
    '',
    'stage=',
    'stage=Merged',
    'stage=in_review',
    'stage=closed',
    'stage=%20merged',
    'stage=bogus&stage=merged',
  ])('reads %j as no stage', (search) => {
    expect(stageOf(new URLSearchParams(search))).toBeNull();
  });
});

describe('featureSortOf', () => {
  it('defaults to the last activity', () => {
    expect(featureSortOf(new URLSearchParams(''))).toBe('last');
    expect(featureSortOf(new URLSearchParams('sort=cost'))).toBe('last');
    expect(featureSortOf(new URLSearchParams('sort=Tokens'))).toBe('last');
  });

  it('reads each option, the first one when repeated', () => {
    expect(featureSortOf(new URLSearchParams('sort=score'))).toBe('score');
    expect(featureSortOf(new URLSearchParams('sort=rounds&sort=tokens'))).toBe(
      'rounds',
    );
  });
});

describe('withListParams', () => {
  const current = new URLSearchParams(
    'period=7d&project=%2Fhome%2Fdev%2Fapp&sort=cost&order=desc&stage=a&stage=b',
  );

  it('leaves no parameter for the default sort and no stage', () => {
    expect(
      withListParams(current, { sort: 'last', stage: null }).toString(),
    ).toBe('period=7d&project=%2Fhome%2Fdev%2Fapp');
  });

  it('keeps one sort and one stage', () => {
    expect(
      withListParams(current, { sort: 'tokens', stage: 'merged' }).toString(),
    ).toBe('period=7d&project=%2Fhome%2Fdev%2Fapp&sort=tokens&stage=merged');
  });
});

describe('groupOf', () => {
  it('maps each stage to its group of spec 024', () => {
    expect(
      boardFeatures.map((row) => [row.number, groupOf(row)] as const),
    ).toEqual([
      [61, 'in-review'],
      [60, 'in-review'],
      [57, 'working'],
      [58, 'working'],
      [63, 'ready'],
      [64, 'ready'],
      [52, 'merged'],
      [48, 'merged'],
      [45, 'merged'],
      [44, 'closed'],
      [70, 'unknown'],
      [12, 'unknown'],
    ]);
  });

  it('puts the open stage in ready', () => {
    const row = at(63);
    expect(
      groupOf({
        ...row,
        outcome: { stage: 'open', report: null, reworked: false },
      }),
    ).toBe('ready');
  });
});

describe('groupRows', () => {
  it('orders the groups and leaves empty ones out', () => {
    expect(
      groupRows(boardFeatures, 'last', null).map(({ group }) => group),
    ).toEqual(['in-review', 'working', 'ready', 'merged', 'closed', 'unknown']);
    expect(
      groupRows([at(52), at(61)], 'last', null).map(({ group }) => group),
    ).toEqual(['in-review', 'merged']);
  });

  it('keeps only the selected stage group', () => {
    const groups = groupRows(boardFeatures, 'last', 'merged');
    expect(groups.map(({ group }) => group)).toEqual(['merged']);
    expect(labels(groups[0]?.rows ?? [])).toEqual(['#45', '#52', '#48']);
    expect(groupRows([at(61)], 'last', 'ready')).toEqual([]);
  });

  it('sorts rows inside each group', () => {
    const groups = groupRows(boardFeatures, 'tokens', null);
    expect(groups.map(({ rows }) => labels(rows))).toEqual([
      ['#61', '#60'],
      ['#58', '#57'],
      ['#64', '#63'],
      ['#48', '#52', '#45'],
      ['#44'],
      ['#70', '#12'],
    ]);
  });
});

describe('sortRows', () => {
  const merged = [at(52), at(48), at(45), at(60)];

  it.each<[FeatureSortKey, string[]]>([
    ['last', ['#60', '#45', '#52', '#48']],
    ['tokens', ['#48', '#52', '#45', '#60']],
    ['sessions', ['#48', '#52', '#60', '#45']],
    ['rounds', ['#48', '#52', '#45', '#60']],
    ['score', ['#45', '#52', '#48', '#60']],
    ['number', ['#60', '#52', '#48', '#45']],
  ])('sorts by %s, highest first, missing values last', (key, expected) => {
    expect(labels(sortRows(merged, key))).toEqual(expected);
  });

  it('breaks ties by last activity, then issue number', () => {
    const base = at(52);
    const rows = [
      { ...base, number: 1, tokens: 5, lastAt: '2026-01-01T00:00:00.000Z' },
      { ...base, number: 2, tokens: 5, lastAt: '2026-01-02T00:00:00.000Z' },
      { ...base, number: 3, tokens: 5, lastAt: '2026-01-01T00:00:00.000Z' },
      { ...base, number: 4, tokens: 5, lastAt: null },
    ];
    expect(labels(sortRows(rows, 'tokens'))).toEqual(['#2', '#3', '#1', '#4']);
  });
});

describe('stageItems', () => {
  it('counts the issues and tokens of the four groups', () => {
    const items = stageItems(boardFeatures);
    expect(
      items.map(({ group, count, counts }) => [
        group,
        count,
        counts.input + counts.output + counts.cacheRead + counts.cacheWrite,
      ]),
    ).toEqual([
      ['ready', 2, 460_000],
      ['working', 2, 3_100_000],
      ['in-review', 2, 8_300_000],
      ['merged', 3, 14_200_000],
    ]);
  });

  it('keeps known costs and counts the calls without price', () => {
    const merged = stageItems(boardFeatures)[3];
    expect(merged?.costUsd).toBeCloseTo((4_200_000 + 7_100_000) / 500_000);
    expect(merged?.unknownPriceCalls).toBe(290);
    expect(stageItems([at(45)])[3]?.costUsd).toBeNull();
    expect(stageItems([])[0]).toMatchObject({ count: 0, costUsd: 0 });
  });
});

describe('rowRoleColors', () => {
  it('gives each role one colour, by tokens over the list', () => {
    const colors = rowRoleColors([
      {
        ...at(52),
        roles: [
          {
            role: 'reviewer',
            tokens: 10,
            tokenCounts: at(52).tokenCounts,
            costUsd: null,
          },
          {
            role: 'Orchestration',
            tokens: 50,
            tokenCounts: at(52).tokenCounts,
            costUsd: null,
          },
        ],
      },
      {
        ...at(48),
        roles: [
          {
            role: 'builder',
            tokens: 30,
            tokenCounts: at(48).tokenCounts,
            costUsd: null,
          },
        ],
      },
    ]);
    expect([...colors.keys()]).toEqual([
      'Orchestration',
      'builder',
      'reviewer',
    ]);
    expect(colors.get('Orchestration')).toBe(ORCHESTRATION_COLOR);
    expect(colors.get('builder')).not.toBe(colors.get('reviewer'));
  });
});

describe('summaryText', () => {
  it('leaves the merged parts out with no merged issue', () => {
    expect(
      summaryText(1, { issues: 0, withoutPerson: null, tokensPerIssue: null }),
    ).toBe('1 issue');
  });

  it('counts the merged issues and those without a person', () => {
    expect(
      summaryText(12, {
        issues: 3,
        withoutPerson: 2 / 3,
        tokensPerIssue: 4_733_333,
      }),
    ).toBe(
      '12 issues · 3 merged, 2 without a person · 4.7M tokens per merged issue',
    );
  });
});
