import { sql } from 'drizzle-orm';
import { addCounts, countsOf, emptyCounts } from '../overview/tokens.ts';
import type { TokenCounts } from '../overview/types.ts';
import { costOf } from '../pricing.ts';

export interface Usage {
  tokens: TokenCounts;
  costUsd: number | null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function emptyUsage(costUsd: number | null): Usage {
  return { tokens: emptyCounts(), costUsd };
}

export function usageBy(
  rows: Record<string, unknown>[],
  key: string,
): Map<string, Usage> {
  const usages = new Map<string, Usage>();
  for (const row of rows) {
    const id = text(row[key]);
    const usage = usages.get(id) ?? emptyUsage(null);
    const counts = countsOf(row);
    addCounts(usage.tokens, counts);
    const cost = costOf(text(row['model']), counts);
    if (cost !== undefined) usage.costUsd = (usage.costUsd ?? 0) + cost;
    usages.set(id, usage);
  }
  return usages;
}

export const USAGE_SUMS = sql`a.model,
  sum(a.input_tokens) as input,
  sum(a.cache_write_tokens) as cache_write,
  sum(a.cache_read_tokens) as cache_read,
  sum(a.output_tokens) as output`;
