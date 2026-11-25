import type { Allocation } from '../features/allocate.ts';
import type { IssueKind } from '../git-host/kind.ts';

export interface KindScope {
  kind: IssueKind;
  kinds: ReadonlyMap<string, IssueKind>;
}

type Bucket = IssueKind | 'unknown';

const BUCKETS: readonly Bucket[] = ['feature', 'bug', 'unknown'];
const EPSILON = 1e-9;

export function largestRemainder(
  shares: readonly number[],
  total: number,
): number[] {
  const counts = shares.map((share) => Math.floor(share + EPSILON));
  let left = total - counts.reduce((sum, value) => sum + value, 0);
  const order = shares
    .map((share, index) => ({ index, rest: share - (counts[index] ?? 0) }))
    .sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (const { index } of order) {
    if (left <= 0) break;
    counts[index] = (counts[index] ?? 0) + 1;
    left -= 1;
  }
  return counts;
}

export function kindTotals(
  allocation: Allocation,
  { kind, kinds }: KindScope,
): { tokens: number; apiCalls: number } {
  const shares: Record<Bucket, number> = { feature: 0, bug: 0, unknown: 0 };
  let tokens = 0;
  for (const [key, issue] of allocation.issues) {
    const found = kinds.get(key) ?? 'unknown';
    shares[found] += issue.callShare;
    if (found === kind) tokens += issue.tokens;
  }
  const issueCalls =
    allocation.totals.apiCalls - (allocation.noWorkItem?.apiCalls ?? 0);
  const calls = largestRemainder(
    BUCKETS.map((bucket) => shares[bucket]),
    issueCalls,
  );
  return { tokens, apiCalls: calls[BUCKETS.indexOf(kind)] ?? 0 };
}
