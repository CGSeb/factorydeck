import type { TokenCounts } from './types.ts';

type Row = Record<string, unknown>;

const KINDS = ['input', 'cacheWrite', 'cacheRead', 'output'] as const;

export function emptyCounts(): TokenCounts {
  return { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 };
}

export function countsOf(row: Row): TokenCounts {
  return {
    input: Number(row['input']),
    cacheWrite: Number(row['cache_write']),
    cacheRead: Number(row['cache_read']),
    output: Number(row['output']),
  };
}

export function totalTokens(counts: TokenCounts): number {
  return counts.input + counts.cacheWrite + counts.cacheRead + counts.output;
}

export function addCounts(
  target: TokenCounts,
  counts: TokenCounts,
  weight = 1,
): TokenCounts {
  for (const kind of KINDS) target[kind] += counts[kind] * weight;
  return target;
}

export function roundCounts(counts: TokenCounts): TokenCounts {
  const rounded = emptyCounts();
  for (const kind of KINDS) rounded[kind] = Math.round(counts[kind]);
  let difference = Math.round(totalTokens(counts)) - totalTokens(rounded);
  const bySize = [...KINDS].sort((left, right) => counts[right] - counts[left]);
  for (const kind of bySize) {
    if (difference === 0) break;
    const change = Math.max(difference, -rounded[kind]);
    rounded[kind] += change;
    difference -= change;
  }
  return rounded;
}

export function withTokenCounts<T extends { tokens: number }>(
  row: T,
  counts: TokenCounts,
): T & { tokenCounts: TokenCounts } {
  const tokenCounts = roundCounts(counts);
  return { ...row, tokens: totalTokens(tokenCounts), tokenCounts };
}
