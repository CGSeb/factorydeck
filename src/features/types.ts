import type { ProjectOption } from '../projects/label.ts';
import type {
  IssueDetail,
  IssueOutcome,
  WorkItemIssue,
} from '../git-host/types.ts';
import type { Period } from '../overview/types.ts';
import type { SessionState } from '../sessions/types.ts';

export const ORCHESTRATION_ROLE = 'Orchestration';

export function issueNumber(value: string): number | undefined {
  if (!/^\d+$/.test(value)) return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
}

export interface FeatureUsage {
  sessions: number;
  apiCalls: number;
  tokens: number;
  costUsd: number | null;
  orchestrationCostUsd: number | null;
}

export interface FeatureRow extends FeatureUsage {
  project: string;
  projectName: string;
  number: number;
  issue: WorkItemIssue;
  outcome: IssueOutcome | null;
}

export interface FeatureTotals {
  apiCalls: number;
  tokens: number;
  costUsd: number;
  unknownPriceCalls: number;
}

export interface MergedSummary {
  issues: number;
  costPerIssueUsd: number | null;
  withoutPerson: number | null;
  unknownPriceCalls: number;
}

export interface FeatureList {
  rows: FeatureRow[];
  noWorkItem: FeatureUsage | null;
  totals: FeatureTotals;
  merged: MergedSummary;
  projects: ProjectOption[];
}

export interface FeatureQuery {
  period: Period;
  timeZone: string;
  project?: string | undefined;
  now?: Date;
}

export interface FeatureRole {
  role: string;
  threads: number;
  apiCalls: number;
  tokens: number;
  costUsd: number | null;
}

export interface FeatureSession {
  id: string;
  title: string;
  state: SessionState;
  lastAt: string | null;
  tokens: number;
  costUsd: number | null;
}

export interface FeatureDetail {
  project: string;
  projectName: string;
  number: number;
  issue: WorkItemIssue;
  detail: IssueDetail | null;
  roles: FeatureRole[];
  orchestration: FeatureRole | null;
  sessions: FeatureSession[];
}

interface Refresh {
  updatedAt: string | null;
  refreshSeconds: number;
}

export type FeatureListResponse =
  | ({ status: 'ok'; list: FeatureList } & Refresh)
  | { status: 'unreachable'; refreshSeconds: number };

export type FeatureResponse =
  | ({ status: 'ok'; feature: FeatureDetail } & Refresh)
  | { status: 'not-found'; refreshSeconds: number }
  | { status: 'unreachable'; refreshSeconds: number };
