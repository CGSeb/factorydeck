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
