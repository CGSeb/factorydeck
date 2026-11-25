import type { IssueStage, Reproduced } from '../git-host/types.ts';
import type { TokenCounts } from '../overview/types.ts';
import type { ProjectOption } from '../projects/label.ts';

export const BUG_GROUPS = ['open', 'fixing', 'fixed'] as const;

export type BugGroup = (typeof BUG_GROUPS)[number];

export interface BugFix {
  rootCause: string | null;
  reproduced: Reproduced | null;
  request: { number: number; url: string };
}

export interface BugVersion {
  number: number;
  count: number;
  startedAt: string;
}

export interface BugVersionSpan extends BugVersion {
  endedAt: string | null;
  reopenedAt: string | null;
}

export interface BugRow {
  project: string;
  projectName: string;
  number: number;
  title: string;
  url: string;
  stage: IssueStage;
  createdAt: string;
  version: BugVersion;
  mergedAt: string | null;
  closedAt: string | null;
  fix: BugFix | null;
  score: number | null;
  threshold: number | null;
  lastAt: string | null;
  tokens: number;
  tokenCounts: TokenCounts;
  costUsd: number | null;
}

export interface BugCounts {
  open: number;
  fixed: number;
  closed: number;
}

export interface BugList {
  bugTickets: boolean;
  groups: Record<BugGroup, BugRow[]>;
  counts: BugCounts;
  projects: ProjectOption[];
}

export type BugListResponse =
  | {
      status: 'ok';
      updatedAt: string | null;
      refreshSeconds: number;
      list: BugList;
    }
  | { status: 'unreachable'; refreshSeconds: number };
