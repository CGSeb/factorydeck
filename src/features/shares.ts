import { addCounts, emptyCounts } from '../overview/tokens.ts';
import type { TokenCounts } from '../overview/types.ts';
import type { FeatureTotals } from './types.ts';
import { addCost, earliest, latest } from './values.ts';

export interface Share {
  cost: number | undefined;
  tokens: number;
  counts: TokenCounts;
}

export interface ThreadAccumulator {
  sessionId: string;
  sessionTitle: string;
  threadId: string;
  role: string;
  description: string | null;
  firstAt: string | null;
  lastAt: string | null;
  tokens: number;
  tokenCounts: TokenCounts;
  costUsd: number | null;
}

export interface RoleAccumulator {
  role: string;
  threads: Set<string>;
  apiCalls: number;
  tokens: number;
  tokenCounts: TokenCounts;
  costUsd: number | null;
}

interface ThreadGroup {
  sessionId: string;
  sessionTitle: string;
  subAgent: string;
  role: string;
  description: string | null;
  firstAt: string | null;
  lastAt: string | null;
}

interface PricedGroup {
  calls: number;
  tokens: number;
  counts: TokenCounts;
  costUsd: number | undefined;
}

export function addToThread(
  threads: Map<string, ThreadAccumulator>,
  group: ThreadGroup,
  share: Share,
): void {
  const key = `${group.sessionId}/${group.subAgent}`;
  const thread = threads.get(key) ?? {
    sessionId: group.sessionId,
    sessionTitle: group.sessionTitle,
    threadId: group.subAgent === '' ? group.sessionId : group.subAgent,
    role: group.role,
    description: group.description,
    firstAt: null,
    lastAt: null,
    tokens: 0,
    tokenCounts: emptyCounts(),
    costUsd: null,
  };
  thread.firstAt = earliest(thread.firstAt, group.firstAt);
  thread.lastAt = latest(thread.lastAt, group.lastAt);
  thread.tokens += share.tokens;
  addCounts(thread.tokenCounts, share.counts);
  thread.costUsd = addCost(thread.costUsd, share.cost);
  threads.set(key, thread);
}

export function emptyRole(role: string): RoleAccumulator {
  return {
    role,
    threads: new Set(),
    apiCalls: 0,
    tokens: 0,
    tokenCounts: emptyCounts(),
    costUsd: null,
  };
}

export function addToRole(
  role: RoleAccumulator,
  group: { sessionId: string; subAgent: string; calls: number },
  share: Share,
): void {
  role.threads.add(`${group.sessionId}/${group.subAgent}`);
  role.apiCalls += group.calls;
  role.tokens += share.tokens;
  addCounts(role.tokenCounts, share.counts);
  role.costUsd = addCost(role.costUsd, share.cost);
}

export function totalsOf(groups: PricedGroup[]): FeatureTotals {
  const totals: FeatureTotals = {
    apiCalls: 0,
    tokens: 0,
    tokenCounts: emptyCounts(),
    costUsd: 0,
    unknownPriceCalls: 0,
  };
  for (const group of groups) {
    totals.apiCalls += group.calls;
    totals.tokens += group.tokens;
    addCounts(totals.tokenCounts, group.counts);
    if (group.costUsd === undefined) totals.unknownPriceCalls += group.calls;
    else totals.costUsd += group.costUsd;
  }
  return totals;
}
