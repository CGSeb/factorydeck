import type { Unreachable } from '../server/api-context.ts';
import type { IssueKind } from '../git-host/kind.ts';
import type { KindCounts } from '../features/types.ts';
import type { ProjectOption } from '../projects/label.ts';

export type TrendUnit = 'hour' | 'day' | 'week' | 'month' | 'year';

export interface AutonomyCounts {
  merged: number;
  mergedWithoutPerson: number;
  mergedAfterQuestion: number;
  stopWaitsMs: number[];
}

export interface AutonomyBucket {
  start: string;
  merged: number;
  mergedWithoutPerson: number;
}

export interface AutonomyReasons {
  below1To5: number;
  below6To15: number;
  below16Plus: number;
  gatesFailed: number;
  specQuestion: number;
  autoMergeOff: number;
  total: number;
  roundsSum: number;
  roundsCount: number;
}

export interface AutonomyStats {
  current: AutonomyCounts;
  previous?: AutonomyCounts;
  waitingNow: number;
  unit: TrendUnit;
  buckets: AutonomyBucket[];
  reasons: AutonomyReasons;
}

export type AutonomyResponse =
  | {
      status: 'ok';
      updatedAt: string | null;
      refreshSeconds: number;
      autonomy: AutonomyStats;
    }
  | Unreachable;

export interface QualityCounts {
  merged: number;
  mergedWithReport: number;
  firstPassed: number;
  roundsSum: number;
  roundsCount: number;
  gainSum: number;
  gainCount: number;
}

export interface QualityBucket {
  start: string;
  mergedWithReport: number;
  firstPassed: number;
}

export interface FirstReport {
  score: number;
  threshold: number;
  time: string;
}

export interface QualityStats {
  current: QualityCounts;
  previous?: QualityCounts;
  unit: TrendUnit;
  buckets: QualityBucket[];
  firstReports: FirstReport[];
}

export type QualityResponse =
  | {
      status: 'ok';
      updatedAt: string | null;
      refreshSeconds: number;
      quality: QualityStats;
    }
  | Unreachable;

export interface FlowIssue {
  leadMs: number;
  cycleMs: number | null;
  tokens: number | null;
}

export interface FlowStripIssue extends FlowIssue {
  project: string;
  number: number;
  title: string;
}

export interface FlowTokens {
  total: number;
  droppedWork: number;
  noWorkItem: number;
  rework: number;
  apiCalls: number;
}

export interface FlowPeriod<Issue extends FlowIssue = FlowIssue> {
  issues: Issue[];
  tokens: FlowTokens;
}

export interface FlowBucket {
  start: string;
  merged: number;
}

export interface FlowStats {
  current: FlowPeriod<FlowStripIssue>;
  previous?: FlowPeriod;
  unit: TrendUnit;
  buckets: FlowBucket[];
}

export type FlowResponse =
  | {
      status: 'ok';
      updatedAt: string | null;
      refreshSeconds: number;
      flow: FlowStats;
    }
  | Unreachable;

export type WaitReason =
  'blocked' | 'spec-question' | 'below-threshold' | 'gates-failed';

export interface WaitingIssue {
  project: string;
  projectName: string;
  number: number;
  title: string;
  kind: IssueKind;
  reasons: WaitReason[];
  since: string | null;
  score?: number;
}

export interface WaitingList {
  issues: WaitingIssue[];
  projects: ProjectOption[];
}

export type WaitingResponse =
  | {
      status: 'ok';
      updatedAt: string | null;
      refreshSeconds: number;
      waiting: WaitingList;
    }
  | Unreachable;

export interface BugOpenings {
  created: number;
  reopened: number;
}

export interface BugCounts {
  merged: number;
  bugs: number;
  reopened: number;
  fixMs: number[];
  openings: BugOpenings;
}

export interface BugStripIssue {
  project: string;
  number: number;
  title: string;
  fixMs: number;
}

export interface BugBucket {
  start: string;
  merged: number;
  bugs: number;
  opened: number;
}

export interface BugStats {
  current: BugCounts;
  previous?: BugCounts;
  issues: BugStripIssue[];
  unit: TrendUnit;
  buckets: BugBucket[];
  bugTickets: boolean;
  kinds: KindCounts;
}

export type BugResponse =
  | {
      status: 'ok';
      updatedAt: string | null;
      refreshSeconds: number;
      bugs: BugStats;
    }
  | Unreachable;
