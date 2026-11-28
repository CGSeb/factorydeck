import type { Unreachable } from '../server/api-context.ts';
import {
  type CommandRow,
  FRICTION_CATEGORIES,
  type FrictionCategory,
  type HookRow,
  type RepeatedRow,
  type ToolRow,
} from './types.ts';

export const OCCURRENCE_TABLES = [
  'category',
  'tool',
  'command',
  'repeated',
  'hook',
] as const;

export type OccurrenceTable = (typeof OCCURRENCE_TABLES)[number];

export const MAX_OCCURRENCES = 5;

export type OccurrenceRow =
  | { table: 'category'; category: FrictionCategory }
  | { table: 'tool'; tool: string }
  | { table: 'command'; program: string | null }
  | {
      table: 'repeated';
      sessionId: string;
      subAgentId: string;
      commandHash: string;
    }
  | { table: 'hook'; command: string };

const REPEATED_KEY = /^(.+)\/([^/]*)\/([^/]+)$/;

function parseTable(value: unknown): OccurrenceTable | undefined {
  return OCCURRENCE_TABLES.find((table) => table === value);
}

function repeatedRow(row: string): OccurrenceRow | undefined {
  const [, sessionId, subAgentId, commandHash] = REPEATED_KEY.exec(row) ?? [];
  if (
    sessionId === undefined ||
    subAgentId === undefined ||
    commandHash === undefined
  ) {
    return undefined;
  }
  return { table: 'repeated', sessionId, subAgentId, commandHash };
}

function categoryRow(row: string): OccurrenceRow | undefined {
  const category = FRICTION_CATEGORIES.find((value) => value === row);
  return category === undefined ? undefined : { table: 'category', category };
}

const ROW_PARSERS: Record<
  OccurrenceTable,
  (row: string) => OccurrenceRow | undefined
> = {
  category: categoryRow,
  tool: (row) => ({ table: 'tool', tool: row }),
  command: (row) => ({ table: 'command', program: row === '' ? null : row }),
  repeated: repeatedRow,
  hook: (row) => ({ table: 'hook', command: row }),
};

export function parseOccurrenceRow(
  table: unknown,
  row: unknown,
): OccurrenceRow | undefined {
  const name = parseTable(table);
  if (name === undefined || typeof row !== 'string') return undefined;
  return ROW_PARSERS[name](row);
}

export function categoryParam(category: FrictionCategory): string {
  return category;
}

export function toolParam(row: ToolRow): string {
  return row.tool;
}

export function commandParam(row: CommandRow): string {
  return row.program ?? '';
}

export function repeatedParam(row: RepeatedRow): string {
  return `${row.sessionId}/${row.subAgentId}/${row.commandHash}`;
}

export function hookParam(row: HookRow): string {
  return row.command;
}

export type LogTexts =
  | { kind: 'tool-error'; input: string; output: string }
  | { kind: 'stop-blocked'; message: string };

export type OccurrenceTexts =
  | { kind: 'tool-error'; input: string; error: string; shell: boolean }
  | { kind: 'stop-blocked'; message: string };

export const OCCURRENCE_DETAILS = ['local', 'gone', 'remote'] as const;

export type OccurrenceDetails = (typeof OCCURRENCE_DETAILS)[number];

export interface FrictionOccurrence {
  id: number;
  at: string;
  role: string;
  project: string;
  workItem: number | null;
  sessionId: string;
  sessionTitle: string;
  exitCode: number | null;
  hasMore: boolean;
  details: OccurrenceDetails;
  texts: OccurrenceTexts | null;
}

export type FullOutput =
  { gone: true; remote?: true } | { gone: false; text: string };

export type FullOutputResponse = ({ status: 'ok' } & FullOutput) | Unreachable;

export type OccurrencesResponse =
  { status: 'ok'; occurrences: FrictionOccurrence[] } | Unreachable;
