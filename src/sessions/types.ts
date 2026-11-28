import type { ProjectOption } from '../projects/label.ts';
import type { IssueDetail, WorkItemIssue } from '../git-host/types.ts';
import type { IssueKind } from '../git-host/kind.ts';
import type { Period, TokenCounts } from '../overview/types.ts';
import type { SkillUsage } from '../skills/types.ts';

export const SESSION_STATES = ['working', 'waiting', 'inactive'] as const;

export type SessionState = (typeof SESSION_STATES)[number];

export function isSessionState(value: unknown): value is SessionState {
  return SESSION_STATES.some((state) => state === value);
}

export const SESSION_PAGE_SIZE = 50;

export const SESSION_MAX_ROWS = 500;

export const CLAUDE_CODE_AGENT = 'claude-code';
export const CODEX_AGENT = 'codex';

const AGENT_LABELS: Readonly<Record<string, string>> = {
  [CLAUDE_CODE_AGENT]: 'Claude Code',
  [CODEX_AGENT]: 'Codex',
};

export function agentLabel(agent: string): string {
  return AGENT_LABELS[agent] ?? agent;
}

export interface SessionSummary {
  id: string;
  agent: string;
  title: string;
  project: string;
  projectName: string;
  /** Every git branch of the main thread, in the order it first appeared. */
  gitBranches: string[];
  workItem: number | null;
  issue: WorkItemIssue | null;
  kind: IssueKind | null;
  state: SessionState;
  firstAt: string | null;
  lastAt: string | null;
  tokens: number;
  tokenCounts: TokenCounts;
  costUsd: number | null;
}

export type StateCounts = Record<SessionState, number>;

export interface SessionList {
  sessions: SessionSummary[];
  total: number;
  counts: StateCounts;
  agents: string[];
  projects: ProjectOption[];
}

export interface SessionListQuery {
  period: Period;
  timeZone: string;
  project?: string | undefined;
  state?: SessionState | undefined;
  limit: number;
}

export interface SubAgentSummary {
  id: string;
  agentType: string;
  role: string;
  workItem: number | null;
  issue: WorkItemIssue | null;
  kind: IssueKind | null;
  description: string;
  model: string;
  firstAt: string | null;
  lastAt: string | null;
  tokens: number;
  tokenCounts: TokenCounts;
  costUsd: number | null;
}

export interface SentBy {
  name: string | null;
  machine: string;
}

export interface SessionDetail extends Omit<
  SessionSummary,
  'tokens' | 'tokenCounts'
> {
  cwd: string | null;
  sentBy: SentBy | null;
  tokens: TokenCounts;
  issueDetail: IssueDetail | null;
  subAgents: SubAgentSummary[];
  skills: SkillUsage[];
  frictions: number;
  projects: ProjectOption[];
}

interface Refresh {
  updatedAt: string | null;
  refreshSeconds: number;
}

export type SessionListResponse =
  | ({ status: 'ok'; list: SessionList } & Refresh)
  | { status: 'unreachable'; refreshSeconds: number };

export type SessionResponse =
  | ({ status: 'ok'; session: SessionDetail } & Refresh)
  | { status: 'not-found'; refreshSeconds: number }
  | { status: 'unreachable'; refreshSeconds: number };
