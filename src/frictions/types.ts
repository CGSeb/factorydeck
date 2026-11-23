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
}

export type FrictionsResponse =
  | {
      status: 'ok';
      updatedAt: string | null;
      refreshSeconds: number;
      frictions: FrictionStats;
    }
  | Unreachable;
