import { sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { select } from '../overview/query.ts';
import { totalTokens } from '../overview/tokens.ts';
import { type WorkflowRules, roleOf, workItemOf } from '../roles/config.ts';
import { type SessionMarkers, markerAt } from '../roles/markers.ts';
import type { SessionSummary, SubAgentSummary } from './types.ts';
import { emptyUsage, usageBy } from './usage.ts';

type Row = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function timestamp(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return new Date(value).toISOString();
  return null;
}

export async function subAgentRows(db: Database, id: string): Promise<Row[]> {
  return select(
    db,
    sql`select sa.id, sa.agent_type, sa.description, sa.model, sa.git_branch,
      sa.first_at, sa.last_at,
      (select min(a.at) from api_call a
        where a.session_id = sa.session_id and a.sub_agent_id = sa.id) as first_call_at
    from sub_agent sa where sa.session_id = ${id}
    order by first_at asc nulls last, id`,
  );
}

export function subAgentsOf(
  agentRows: Row[],
  usageRows: Row[],
  summary: Pick<SessionSummary, 'id' | 'title' | 'workItem'>,
  { rules, markers }: { rules: WorkflowRules; markers: SessionMarkers },
): Omit<SubAgentSummary, 'issue' | 'kind'>[] {
  const byAgent = usageBy(usageRows, 'sub_agent');
  const sessionMarkers = markers.get(summary.id);
  return agentRows.map((agent) => {
    const agentUsage = byAgent.get(text(agent['id'])) ?? emptyUsage(0);
    const agentType = text(agent['agent_type']);
    const description = text(agent['description']);
    return {
      id: text(agent['id']),
      agentType,
      role: roleOf(rules, { agentType, description }),
      workItem:
        workItemOf(rules, {
          description,
          branch: text(agent['git_branch']),
          title: sessionMarkers === undefined ? summary.title : undefined,
        }) ??
        markerAt(sessionMarkers, agent['first_at'] ?? agent['first_call_at'])
          ?.workItem ??
        summary.workItem,
      description,
      model: text(agent['model']),
      firstAt: timestamp(agent['first_at']),
      lastAt: timestamp(agent['last_at']),
      tokens: totalTokens(agentUsage.tokens),
      tokenCounts: agentUsage.tokens,
      costUsd: agentUsage.costUsd,
    };
  });
}
