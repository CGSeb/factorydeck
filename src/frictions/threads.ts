import { subAgentWorkItem } from '../features/allocate.ts';
import { text, timestamp } from '../features/values.ts';
import {
  MAIN_ROLE,
  type WorkflowConfig,
  roleOf,
  rulesFor,
  workItemOf,
} from '../roles/config.ts';
import {
  type Marker,
  type SessionMarkers,
  markerAt,
  markerOfRow,
} from '../roles/markers.ts';
import {
  type AttributedFriction,
  type ThreadCalls,
  threadKeyOf,
} from './breakdown.ts';
import type { ThreadInfo } from './summarize.ts';
import type { FrictionFilter } from './types.ts';

export type Row = Record<string, unknown>;

export interface LoadedRow extends AttributedFriction {
  source: Row;
}

export interface CallGroup extends ThreadCalls {
  source: Row;
  workItem: number | null;
  project: string;
  inPeriod: boolean;
  inPrevious: boolean;
  slot: number | null;
}

function numberOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function slotOf(value: unknown): number | null {
  const at = timestamp(value);
  return at === null ? null : Date.parse(at);
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function threadInfo(
  config: WorkflowConfig,
  markers: SessionMarkers,
  source: Row,
  marker: Marker | undefined,
): ThreadInfo {
  const project = text(source['project']);
  const rules = rulesFor(config, text(source['root']), project);
  if (text(source['sub_agent']) !== '') {
    return {
      project,
      role: roleOf(rules, {
        agentType: text(source['agent_type']),
        description: text(source['description']),
      }),
      workItem: subAgentWorkItem(
        rules,
        source,
        markers.get(text(source['session_id'])),
      ),
    };
  }
  return {
    project,
    role: marker?.role ?? MAIN_ROLE,
    workItem:
      marker?.workItem ??
      workItemOf(rules, {
        branch: text(source['session_branch']),
        title: text(source['title']),
      }),
  };
}

export function frictionOf(
  config: WorkflowConfig,
  markers: SessionMarkers,
  row: Row,
): LoadedRow {
  const at = timestamp(row['at']) ?? '';
  const sessionId = text(row['session_id']);
  const subAgentId = text(row['sub_agent']);
  return {
    at,
    kind: text(row['kind']),
    sessionId,
    subAgentId,
    sessionTitle: text(row['title']),
    tool: textOrNull(row['tool']),
    category: textOrNull(row['category']),
    program: textOrNull(row['program']),
    exitCode: numberOrNull(row['exit_code']),
    commandHash: textOrNull(row['command_hash']),
    hookCommand: textOrNull(row['hook_command']),
    trigger: textOrNull(row['trigger']),
    preTokens: numberOrNull(row['pre_tokens']),
    thread: threadInfo(
      config,
      markers,
      row,
      subAgentId === '' ? markerAt(markers.get(sessionId), at) : undefined,
    ),
    source: row,
  };
}

export function callGroupOf(
  config: WorkflowConfig,
  markers: SessionMarkers,
  row: Row,
): CallGroup {
  const sessionId = text(row['session_id']);
  const subAgentId = text(row['sub_agent']);
  const thread = threadInfo(
    config,
    markers,
    row,
    subAgentId === '' ? markerOfRow(markers, row) : undefined,
  );
  return {
    key: threadKeyOf(sessionId, subAgentId),
    sessionId,
    sessionTitle: text(row['title']),
    sessionAgent: text(row['agent']),
    description: subAgentId === '' ? null : text(row['description']),
    role: thread.role,
    workItem: thread.workItem,
    project: thread.project,
    calls: Number(row['calls']),
    peak: Number(row['peak'] ?? 0),
    inPeriod: row['in_period'] === true,
    inPrevious: row['in_previous'] === true,
    slot: slotOf(row['slot']),
    source: row,
  };
}

export function onIssue(
  filter: FrictionFilter | undefined,
  project: string | null,
): (thread: { project: string; workItem: number | null }) => boolean {
  const issue = filter?.issue;
  if (issue === undefined) return () => true;
  return (thread) => thread.project === project && thread.workItem === issue;
}
