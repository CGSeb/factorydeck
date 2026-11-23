import { issueNumber } from '../features/types.ts';
import type { IssueStage, WorkItemIssue } from '../git-host/types.ts';
import type { ProjectOption } from '../projects/label.ts';
import type { Unreachable } from '../server/api-context.ts';

export const FRICTION_KINDS = [
  'tool-error',
  'stop-blocked',
  'compaction',
] as const;

export type FrictionKind = (typeof FRICTION_KINDS)[number];

export const FRICTION_CATEGORIES = [
  'permission-denied',
  'hook-blocked',
  'tool-misuse',
  'command-failed',
  'other',
] as const;

export type FrictionCategory = (typeof FRICTION_CATEGORIES)[number];

export const COMPACTION_TRIGGERS = ['auto', 'manual', 'other'] as const;

export type CompactionTrigger = (typeof COMPACTION_TRIGGERS)[number];

export const REPEATED_FAILURES = 3;

export function parseKind(value: unknown): FrictionKind | undefined {
  return FRICTION_KINDS.find((kind) => kind === value);
}

export function categoryOf(value: unknown): FrictionCategory {
  return FRICTION_CATEGORIES.find((category) => category === value) ?? 'other';
}

export type KindCounts = Record<FrictionKind, number>;

export interface FrictionWeek {
  start: string;
  frictions: number;
  apiCalls: number;
}

export interface CategoryRow {
  category: FrictionCategory;
  errors: number;
}

export interface ToolRow {
  tool: string;
  errors: number;
  mainCategory: FrictionCategory;
  threads: number;
}

export interface CommandRow {
  program: string | null;
  failures: number;
  exitCodes: number[];
  distinctCommands: number;
}

export interface RepeatedRow {
  program: string | null;
  failures: number;
  role: string;
  project: string;
  workItem: number | null;
  sessionId: string;
  sessionTitle: string;
  lastAt: string;
}

export interface HookRow {
  command: string;
  blocks: number;
  sessions: number;
  lastAt: string;
}

export interface CompactionRow {
  trigger: CompactionTrigger;
  compactions: number;
  medianPreTokens: number | null;
  threads: number;
}

export type FrictionFilter =
  | { session: string; issue?: undefined }
  | { session?: undefined; issue: number };

export function frictionFilterOf({
  session,
  issue,
  project,
}: {
  session: string | null | undefined;
  issue: string | null | undefined;
  project: string | null | undefined;
}): FrictionFilter | undefined {
  if (session !== null && session !== undefined && session !== '') {
    return { session };
  }
  const number =
    issue === null || issue === undefined ? undefined : issueNumber(issue);
  if (
    number === undefined ||
    project === null ||
    project === undefined ||
    project === ''
  ) {
    return undefined;
  }
  return { issue: number };
}

export type FrictionSubject =
  | { kind: 'session'; id: string; title: string | null; agent: string }
  | { kind: 'issue'; project: string; number: number; issue: WorkItemIssue };

export interface RoleFrictionRow {
  role: string;
  threads: number;
  frictions: number;
  perThread: number;
  mainKind: FrictionKind | null;
}

export interface IssueFrictionRow {
  project: string;
  projectName: string;
  number: number;
  issue: WorkItemIssue;
  stage: IssueStage | null;
  frictions: number;
  repeated: number;
  compactions: number;
}

export interface ThreadPeak {
  sessionId: string;
  sessionTitle: string;
  sessionAgent: string;
  description: string | null;
  peak: number;
}

export interface ContextPeaks {
  threads: ThreadPeak[];
  compacted: number;
  medianPeak: number | null;
  previous?: { medianPeak: number | null; threads: number };
}

export interface FrictionStats {
  kind: FrictionKind | null;
  frictions: number;
  apiCalls: number;
  counts: KindCounts;
  weeks: FrictionWeek[];
  categories: CategoryRow[];
  tools: ToolRow[];
  commands: CommandRow[];
  repeated: RepeatedRow[];
  hooks: HookRow[];
  compactions: CompactionRow[];
  subject: FrictionSubject | null;
  roles: RoleFrictionRow[];
  issues: IssueFrictionRow[];
  context: ContextPeaks;
  projects: ProjectOption[];
}

export type FrictionsResponse =
  | {
      status: 'ok';
      updatedAt: string | null;
      refreshSeconds: number;
      frictions: FrictionStats;
    }
  | Unreachable;
