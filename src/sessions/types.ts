import type { Period, TokenCounts } from '../overview/types.ts';

export const SESSION_STATES = ['working', 'waiting', 'inactive'] as const;

export type SessionState = (typeof SESSION_STATES)[number];

export function isSessionState(value: unknown): value is SessionState {
  return SESSION_STATES.some((state) => state === value);
}

export const SESSION_PAGE_SIZE = 50;

export const SESSION_MAX_ROWS = 500;

export interface SessionSummary {
  id: string;
  title: string;
  project: string;
  gitBranch: string;
  state: SessionState;
  firstAt: string | null;
  lastAt: string | null;
  tokens: number;
  costUsd: number | null;
}

export type StateCounts = Record<SessionState, number>;

export interface SessionList {
  sessions: SessionSummary[];
  total: number;
  counts: StateCounts;
  projects: string[];
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
  description: string;
  model: string;
  firstAt: string | null;
  lastAt: string | null;
  tokens: number;
  costUsd: number | null;
}

export interface SessionDetail extends Omit<SessionSummary, 'tokens'> {
  cwd: string | null;
  tokens: TokenCounts;
  subAgents: SubAgentSummary[];
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
