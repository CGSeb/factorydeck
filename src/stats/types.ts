import type { Unreachable } from '../server/api-context.ts';

export type TrendUnit = 'hour' | 'day' | 'week' | 'month' | 'year';

export interface AutonomyCounts {
  merged: number;
  mergedWithoutPerson: number;
  mergedAfterQuestion: number;
  answeredWaitsMs: number[];
}

export interface AutonomyBucket {
  start: string;
  merged: number;
  mergedWithoutPerson: number;
}

export interface AutonomyReasons {
  specQuestion: number;
  belowThreshold: number;
  gatesFailed: number;
  autoMergeOff: number;
  total: number;
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
  reworked: number;
  ended: number;
  closedWithoutMerge: number;
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
  inputSide: number;
  cacheRead: number;
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
