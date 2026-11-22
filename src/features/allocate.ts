import {
  addCounts,
  countsOf,
  emptyCounts,
  totalTokens,
} from '../overview/tokens.ts';
import type { TokenCounts } from '../overview/types.ts';
import { costOf } from '../pricing.ts';
import {
  MAIN_ROLE,
  type WorkflowConfig,
  type WorkflowRules,
  roleOf,
  rulesFor,
  workItemOf,
} from '../roles/config.ts';
import {
  type Marker,
  type SessionMarkers,
  markerAt,
  markerOfRow,
} from '../roles/markers.ts';
import { type FeatureTotals, ORCHESTRATION_ROLE } from './types.ts';
import {
  type RoleAccumulator,
  type Share,
  type ThreadAccumulator,
  addToRole,
  addToThread,
  emptyRole,
  totalsOf,
} from './shares.ts';
import { addCost, issueKey, latest, text, timestamp } from './values.ts';

export type Row = Record<string, unknown>;

interface CallGroup {
  sessionId: string;
  sessionTitle: string;
  project: string;
  subAgent: string;
  description: string | null;
  role: string;
  workItem: number | null;
  calls: number;
  tokens: number;
  counts: TokenCounts;
  firstAt: string | null;
  lastAt: string | null;
  costUsd: number | undefined;
}

export interface SessionUsage {
  tokens: number;
  tokenCounts: TokenCounts;
  costUsd: number | null;
}

export interface IssueAccumulator {
  project: string;
  number: number;
  apiCalls: number;
  tokens: number;
  tokenCounts: TokenCounts;
  lastAt: string | null;
  costUsd: number | null;
  orchestrationCostUsd: number | null;
  unknownPriceCalls: number;
  sessions: Map<string, SessionUsage>;
  roles: Map<string, RoleAccumulator>;
  orchestration: RoleAccumulator | null;
  threads: Map<string, ThreadAccumulator>;
}

export interface Pool {
  unknownPriceCalls: number;
  keys: string[];
}

export interface Allocation {
  issues: Map<string, IssueAccumulator>;
  noWorkItem: IssueAccumulator | null;
  pools: Pool[];
  totals: FeatureTotals;
}

function subAgentWorkItem(
  rules: WorkflowRules,
  row: Row,
  sessionMarkers: Marker[] | undefined,
): number | null {
  const own = workItemOf(rules, {
    description: text(row['description']),
    branch: text(row['agent_branch']),
    title: sessionMarkers === undefined ? text(row['title']) : undefined,
  });
  if (own !== null) return own;
  return sessionMarkers === undefined
    ? workItemOf(rules, {
        branch: text(row['session_branch']),
        title: text(row['title']),
      })
    : (markerAt(sessionMarkers, row['agent_first_at'] ?? row['first_at'])
        ?.workItem ?? null);
}

function groupOf(
  config: WorkflowConfig,
  markers: SessionMarkers,
  row: Row,
): CallGroup {
  const project = text(row['project']);
  const rules = rulesFor(config, project);
  const title = text(row['title']);
  const sessionId = text(row['session_id']);
  const subAgent = text(row['sub_agent']);
  const description = text(row['description']);
  const counts = countsOf(row);
  const main = subAgent === '';
  const marker = main ? markerOfRow(markers, row) : undefined;
  return {
    sessionId,
    sessionTitle: title,
    project,
    subAgent,
    description: main ? null : description,
    role: main
      ? (marker?.role ?? MAIN_ROLE)
      : roleOf(rules, { agentType: text(row['agent_type']), description }),
    workItem: main
      ? (marker?.workItem ??
        workItemOf(rules, { branch: text(row['session_branch']), title }))
      : subAgentWorkItem(rules, row, markers.get(sessionId)),
    calls: Number(row['calls']),
    tokens: totalTokens(counts),
    counts,
    firstAt: timestamp(row['first_at']),
    lastAt: timestamp(row['last_at']),
    costUsd: costOf(text(row['model']), counts),
  };
}

function emptyAccumulator(project: string, number: number): IssueAccumulator {
  return {
    project,
    number,
    apiCalls: 0,
    tokens: 0,
    tokenCounts: emptyCounts(),
    lastAt: null,
    costUsd: null,
    orchestrationCostUsd: null,
    unknownPriceCalls: 0,
    sessions: new Map(),
    roles: new Map(),
    orchestration: null,
    threads: new Map(),
  };
}

function addToSession(
  issue: IssueAccumulator,
  sessionId: string,
  share: Share,
): void {
  const session = issue.sessions.get(sessionId) ?? {
    tokens: 0,
    tokenCounts: emptyCounts(),
    costUsd: null,
  };
  session.tokens += share.tokens;
  addCounts(session.tokenCounts, share.counts);
  session.costUsd = addCost(session.costUsd, share.cost);
  issue.sessions.set(sessionId, session);
}

function roleFor(
  issue: IssueAccumulator,
  group: CallGroup,
  orchestration: boolean,
): RoleAccumulator {
  if (orchestration) {
    issue.orchestration ??= emptyRole(ORCHESTRATION_ROLE);
    return issue.orchestration;
  }
  const role = issue.roles.get(group.role) ?? emptyRole(group.role);
  issue.roles.set(group.role, role);
  return role;
}

function addGroup(
  issue: IssueAccumulator,
  group: CallGroup,
  weight: number,
  orchestration: boolean,
): void {
  const share: Share = {
    tokens: group.tokens * weight,
    counts: addCounts(emptyCounts(), group.counts, weight),
    cost: group.costUsd === undefined ? undefined : group.costUsd * weight,
  };
  issue.apiCalls += group.calls;
  issue.tokens += share.tokens;
  addCounts(issue.tokenCounts, share.counts);
  if (!orchestration) issue.lastAt = latest(issue.lastAt, group.lastAt);
  issue.costUsd = addCost(issue.costUsd, share.cost);
  if (group.costUsd === undefined && !orchestration) {
    issue.unknownPriceCalls += group.calls;
  }
  if (orchestration) {
    issue.orchestrationCostUsd = addCost(
      issue.orchestrationCostUsd,
      share.cost,
    );
  }
  addToSession(issue, group.sessionId, share);
  if (!orchestration) addToThread(issue.threads, group, share);
  addToRole(roleFor(issue, group, orchestration), group, share);
}

function groupsBySession(groups: CallGroup[]): CallGroup[][] {
  const sessions = new Map<string, CallGroup[]>();
  for (const group of groups) {
    const list = sessions.get(group.sessionId) ?? [];
    list.push(group);
    sessions.set(group.sessionId, list);
  }
  return [...sessions.values()];
}

class Allocator {
  readonly allocation: Allocation;

  constructor(totals: FeatureTotals) {
    this.allocation = {
      issues: new Map(),
      noWorkItem: null,
      pools: [],
      totals,
    };
  }

  issue(project: string, number: number): IssueAccumulator {
    const key = issueKey(project, number);
    const issue =
      this.allocation.issues.get(key) ?? emptyAccumulator(project, number);
    this.allocation.issues.set(key, issue);
    return issue;
  }

  noWorkItem(group: CallGroup): void {
    this.allocation.noWorkItem ??= emptyAccumulator('', 0);
    addGroup(this.allocation.noWorkItem, group, 1, false);
  }

  session(groups: CallGroup[]): void {
    const weights = new Map<number, number>();
    const pool: CallGroup[] = [];
    for (const group of groups) {
      if (group.workItem === null) {
        if (group.subAgent === '') pool.push(group);
        else this.noWorkItem(group);
        continue;
      }
      addGroup(this.issue(group.project, group.workItem), group, 1, false);
      if (group.subAgent !== '') {
        weights.set(
          group.workItem,
          (weights.get(group.workItem) ?? 0) + group.tokens,
        );
      }
    }
    this.share(pool, weights);
  }

  share(pool: CallGroup[], weights: Map<number, number>): void {
    const total = [...weights.values()].reduce((sum, value) => sum + value, 0);
    const shared = [...weights].filter(([, weight]) => weight > 0);
    if (total === 0) {
      for (const group of pool) this.noWorkItem(group);
      return;
    }
    const [first] = pool;
    if (first === undefined) return;
    for (const group of pool) {
      for (const [number, weight] of shared) {
        addGroup(
          this.issue(group.project, number),
          group,
          weight / total,
          true,
        );
      }
    }
    this.allocation.pools.push({
      unknownPriceCalls: pool
        .filter((group) => group.costUsd === undefined)
        .reduce((sum, group) => sum + group.calls, 0),
      keys: shared.map(([number]) => issueKey(first.project, number)),
    });
  }
}

export function allocate(
  config: WorkflowConfig,
  rows: Row[],
  markers: SessionMarkers = new Map(),
): Allocation {
  const groups = rows.map((row) => groupOf(config, markers, row));
  const allocator = new Allocator(totalsOf(groups));
  for (const session of groupsBySession(groups)) allocator.session(session);
  return allocator.allocation;
}
