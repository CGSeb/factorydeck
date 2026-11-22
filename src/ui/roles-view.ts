import type { TokenCounts } from '../overview/types.ts';
import type { RoleUsage } from '../roles/types.ts';
import { roleColors } from './design/palette.ts';
import { MISSING, formatTokens } from './format.ts';

export interface RoleTotals {
  threads: number;
  apiCalls: number;
  tokens: number;
  tokenCounts: TokenCounts;
  costUsd: number | null;
}

export function byTokensDescending<T extends { tokens: number }>(
  rows: readonly T[],
  name: (row: T) => string,
): T[] {
  return [...rows].sort(
    (a, b) => b.tokens - a.tokens || name(a).localeCompare(name(b)),
  );
}

export function colorsOfRoles(
  order: readonly string[],
  roles: readonly RoleUsage[],
): Map<string, string> {
  const configured = new Set(order);
  const others = roles
    .map((row) => row.role)
    .filter((role) => !configured.has(role))
    .sort((a, b) => a.localeCompare(b));
  return roleColors([...order, ...others]);
}

export function tokensPerThread({ tokens, threads }: RoleUsage): string {
  return threads > 0 ? formatTokens(Math.round(tokens / threads)) : MISSING;
}

export function roleTotals(roles: readonly RoleUsage[]): RoleTotals {
  const totals: RoleTotals = {
    threads: 0,
    apiCalls: 0,
    tokens: 0,
    tokenCounts: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    costUsd: null,
  };
  for (const row of roles) {
    totals.threads += row.threads;
    totals.apiCalls += row.apiCalls;
    totals.tokens += row.tokens;
    totals.tokenCounts.input += row.tokenCounts.input;
    totals.tokenCounts.output += row.tokenCounts.output;
    totals.tokenCounts.cacheRead += row.tokenCounts.cacheRead;
    totals.tokenCounts.cacheWrite += row.tokenCounts.cacheWrite;
    if (row.costUsd !== null) {
      totals.costUsd = (totals.costUsd ?? 0) + row.costUsd;
    }
  }
  return totals;
}
