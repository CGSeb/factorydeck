import { describe, expect, it } from 'vitest';
import type { RoleUsage } from '../roles/types.ts';
import { totalTokens } from './components/token-amount.ts';
import {
  CATEGORY_COLORS,
  ORCHESTRATION_COLOR,
  UNASSIGNED_COLOR,
} from './design/palette.ts';
import {
  byTokensDescending,
  colorsOfRoles,
  roleTotals,
  tokensPerThread,
} from './roles-view.ts';
import { splitTokens } from './token-fixtures.ts';

function usage(
  role: string,
  threads: number,
  tokens: number,
  costUsd: number | null = 1,
): RoleUsage {
  return {
    role,
    threads,
    apiCalls: threads * 10,
    tokens,
    tokenCounts: splitTokens(tokens),
    costUsd,
  };
}

describe('byTokensDescending', () => {
  it('sorts by tokens, unassigned like the others, ties by name', () => {
    const rows = [
      usage('main', 2, 100),
      usage('unassigned', 1, 900),
      usage('reviewer', 1, 300),
      usage('builder', 1, 300),
    ];
    expect(
      byTokensDescending(rows, (row) => row.role).map((row) => row.role),
    ).toEqual(['unassigned', 'builder', 'reviewer', 'main']);
  });
});

describe('colorsOfRoles', () => {
  it('colours configured roles in configuration order, whatever their usage', () => {
    const colors = colorsOfRoles(
      ['builder', 'reviewer', 'shipper'],
      [usage('reviewer', 1, 900), usage('builder', 1, 10)],
    );
    expect(colors.get('builder')).toBe(CATEGORY_COLORS[0]);
    expect(colors.get('reviewer')).toBe(CATEGORY_COLORS[1]);
  });

  it('colours the other roles after them, by name, and unassigned in grey', () => {
    const colors = colorsOfRoles(
      ['builder'],
      [
        usage('main', 1, 900),
        usage('Explore', 1, 10),
        usage('unassigned', 1, 5),
        usage('Orchestration', 1, 5),
      ],
    );
    expect(colors.get('Explore')).toBe(CATEGORY_COLORS[1]);
    expect(colors.get('main')).toBe(CATEGORY_COLORS[2]);
    expect(colors.get('unassigned')).toBe(UNASSIGNED_COLOR);
    expect(colors.get('Orchestration')).toBe(ORCHESTRATION_COLOR);
  });

  it('follows a custom configuration', () => {
    const colors = colorsOfRoles(['writer', 'editor'], [usage('editor', 1, 9)]);
    expect(colors.get('editor')).toBe(CATEGORY_COLORS[1]);
  });
});

describe('tokensPerThread', () => {
  it('divides the tokens by the threads, in compact format', () => {
    expect(tokensPerThread(usage('builder', 4, 9_000_000))).toBe('2.3M');
    expect(tokensPerThread(usage('builder', 3, 1_000))).toBe('333');
  });

  it('shows a dash for a row with no thread', () => {
    expect(tokensPerThread(usage('main', 0, 500))).toBe('—');
  });
});

describe('roleTotals', () => {
  it('adds the threads, calls, tokens and costs of the rows', () => {
    const totals = roleTotals([
      usage('main', 2, 1_000, 1.5),
      usage('builder', 3, 2_000, null),
    ]);
    expect(totals).toMatchObject({ threads: 5, apiCalls: 50, tokens: 3_000 });
    expect(totals.costUsd).toBe(1.5);
    expect(totalTokens(totals.tokenCounts)).toBe(3_000);
  });

  it('keeps an unknown cost when no row has a price', () => {
    expect(roleTotals([usage('main', 1, 10, null)]).costUsd).toBeNull();
    expect(roleTotals([]).tokens).toBe(0);
  });
});
