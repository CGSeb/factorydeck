import type { Unreachable } from '../server/api-context.ts';

export interface AutonomyCounts {
  merged: number;
  mergedWithoutPerson: number;
  mergedAfterQuestion: number;
  answeredWaitsMs: number[];
}

export interface AutonomyWeek {
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
  weeks: AutonomyWeek[];
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

export interface QualityWeek {
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
  weeks: QualityWeek[];
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

export interface FlowWeek {
  start: string;
  merged: number;
}

export interface FlowStats {
  current: FlowPeriod<FlowStripIssue>;
  previous?: FlowPeriod;
  weeks: FlowWeek[];
}

export type FlowResponse =
  | {
      status: 'ok';
      updatedAt: string | null;
      refreshSeconds: number;
      flow: FlowStats;
    }
  | Unreachable;
