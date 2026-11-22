import { type SQL, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { type ProjectNames, projectNames } from '../projects/names.ts';
import { byCostDescending, periodStart, select } from '../overview/query.ts';
import { addCounts, countsOf, emptyCounts } from '../overview/tokens.ts';
import type { TokenCounts } from '../overview/types.ts';
import { costOf } from '../pricing.ts';
import { attributedCalls } from './attribution.ts';
import {
  NO_SKILL_LABEL,
  type SkillDetail,
  type SkillList,
  type SkillQuery,
  type SkillSession,
  type SkillUsage,
} from './types.ts';

type Row = Record<string, unknown>;

interface Scope {
  startAt: string | null;
  project: string | null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function skillOf(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

const USAGE_SUMS = sql`a.model,
  count(*) as calls,
  sum(a.input_tokens) as input,
  sum(a.cache_write_tokens) as cache_write,
  sum(a.cache_read_tokens) as cache_read,
  sum(a.output_tokens) as output`;

function callInScope({ startAt }: Scope, column: SQL): SQL {
  return sql`(${startAt}::timestamptz is null or ${column} >= ${startAt}::timestamptz)`;
}

function sessionInScope(scope: Scope): SQL {
  return sql`(${scope.project}::text is null or s.project = ${scope.project}::text)
    and exists (
      select 1 from api_call c
      where c.session_id = s.id and ${callInScope(scope, sql`c.at`)}
    )`;
}

interface Usage {
  apiCalls: number;
  tokens: number;
  tokenCounts: TokenCounts;
  costUsd: number | null;
}

function emptyUsage(): Usage {
  return { apiCalls: 0, tokens: 0, tokenCounts: emptyCounts(), costUsd: null };
}

function addUsage(usage: Usage, row: Row): Usage {
  const counts = countsOf(row);
  addCounts(usage.tokenCounts, counts);
  usage.apiCalls += Number(row['calls']);
  usage.tokens +=
    counts.input + counts.cacheWrite + counts.cacheRead + counts.output;
  const cost = costOf(text(row['model']), counts);
  if (cost !== undefined) usage.costUsd = (usage.costUsd ?? 0) + cost;
  return usage;
}

function costOrZero({ apiCalls, costUsd }: Usage): number | null {
  return apiCalls === 0 ? 0 : costUsd;
}

function averageOf(costUsd: number | null, launches: number): number | null {
  return costUsd === null || launches === 0 ? null : costUsd / launches;
}

function sortSkills(rows: SkillUsage[]): SkillUsage[] {
  return rows.sort(byCostDescending((row) => row.skill ?? NO_SKILL_LABEL));
}

async function scopeOf(db: Database, query: SkillQuery): Promise<Scope> {
  return {
    startAt: await periodStart(db, query),
    project: query.project ?? null,
  };
}

function buildSkills(usageRows: Row[], launchRows: Row[]): SkillUsage[] {
  const usages = new Map<string | null, Usage>();
  for (const row of usageRows) {
    const skill = skillOf(row['skill']);
    usages.set(skill, addUsage(usages.get(skill) ?? emptyUsage(), row));
  }
  const launches = new Map<string, { launches: number; sessions: number }>(
    launchRows.map((row) => [
      text(row['skill']),
      {
        launches: Number(row['launches']),
        sessions: Number(row['sessions'] ?? 1),
      },
    ]),
  );
  const names = new Set<string | null>([
    null,
    ...launches.keys(),
    ...usages.keys(),
  ]);
  return sortSkills(
    [...names].map((skill) => {
      const usage = usages.get(skill) ?? emptyUsage();
      const launched = (skill === null ? undefined : launches.get(skill)) ?? {
        launches: 0,
        sessions: 0,
      };
      const costUsd = costOrZero(usage);
      return {
        skill,
        ...launched,
        apiCalls: usage.apiCalls,
        tokens: usage.tokens,
        tokenCounts: usage.tokenCounts,
        costUsd,
        averageCostUsd: averageOf(costUsd, launched.launches),
      };
    }),
  );
}

export async function listSkills(
  db: Database,
  query: SkillQuery,
): Promise<SkillList> {
  const scope = await scopeOf(db, query);
  const [usageRows, launchRows, projects] = await Promise.all([
    select(
      db,
      sql`select attr.skill, ${USAGE_SUMS}
        from api_call a join ${attributedCalls(sessionInScope(scope))} attr on attr.call_id = a.id
        where ${callInScope(scope, sql`a.at`)}
        group by attr.skill, a.model`,
    ),
    select(
      db,
      sql`select l.skill, count(*) as launches, count(distinct l.session_id) as sessions
        from skill_launch l join session s on s.id = l.session_id
        where (${scope.project}::text is null or s.project = ${scope.project}::text)
          and ${callInScope(scope, sql`l.at`)}
        group by l.skill`,
    ),
    projectNames(db),
  ]);
  const skills = buildSkills(usageRows, launchRows);
  return {
    skills,
    launches: skills.reduce((sum, row) => sum + row.launches, 0),
    projects: projects.options(),
  };
}

export async function sessionSkills(
  db: Database,
  sessionId: string,
): Promise<SkillUsage[]> {
  const [usageRows, launchRows] = await Promise.all([
    select(
      db,
      sql`select attr.skill, ${USAGE_SUMS}
        from api_call a join ${attributedCalls(sql`s.id = ${sessionId}`)} attr on attr.call_id = a.id
        group by attr.skill, a.model`,
    ),
    select(
      db,
      sql`select l.skill, count(*) as launches from skill_launch l
        where l.session_id = ${sessionId} group by l.skill`,
    ),
  ]);
  return buildSkills(usageRows, launchRows);
}

function seriesQuery(
  scope: Scope,
  skill: string,
  { timeZone, now = new Date() }: SkillQuery,
): SQL {
  return sql`with launches as (
      select date_trunc('day', l.at at time zone ${timeZone}) as day
      from skill_launch l join session s on s.id = l.session_id
      where l.skill = ${skill}
        and (${scope.project}::text is null or s.project = ${scope.project}::text)
        and ${callInScope(scope, sql`l.at`)}
    ),
    bounds as (
      select
        date_trunc('day', coalesce(${scope.startAt}::timestamptz, min(l.at)) at time zone ${timeZone}) as first,
        date_trunc('day', greatest(${now.toISOString()}::timestamptz, max(l.at)) at time zone ${timeZone}) as last
      from skill_launch l join session s on s.id = l.session_id
      where l.skill = ${skill}
        and (${scope.project}::text is null or s.project = ${scope.project}::text)
        and ${callInScope(scope, sql`l.at`)}
    )
    select to_char(step, 'YYYY-MM-DD') as day,
      (select count(*) from launches where launches.day = step) as launches
    from bounds, generate_series(bounds.first, bounds.last, interval '1 day') as step
    where bounds.first is not null
    order by step`;
}

export async function skillDetail(
  db: Database,
  skill: string,
  query: SkillQuery,
): Promise<SkillDetail> {
  const scope = await scopeOf(db, query);
  const [usageRows, launchRows, seriesRows, projects] = await Promise.all([
    select(
      db,
      sql`select a.session_id, ${USAGE_SUMS}
        from api_call a join ${attributedCalls(sessionInScope(scope))} attr on attr.call_id = a.id
        where attr.skill = ${skill} and ${callInScope(scope, sql`a.at`)}
        group by a.session_id, a.model`,
    ),
    select(
      db,
      sql`select s.id, s.title, s.project, count(*) as launches
        from skill_launch l join session s on s.id = l.session_id
        where l.skill = ${skill}
          and (${scope.project}::text is null or s.project = ${scope.project}::text)
          and ${callInScope(scope, sql`l.at`)}
        group by s.id, s.title, s.project`,
    ),
    select(db, seriesQuery(scope, skill, query)),
    projectNames(db),
  ]);
  const total = emptyUsage();
  for (const row of usageRows) addUsage(total, row);
  const sessions = buildSessions(usageRows, launchRows, projects);
  const launches = sessions.reduce((sum, row) => sum + row.launches, 0);
  const costUsd = costOrZero(total);
  return {
    skill,
    launches,
    tokens: total.tokens,
    tokenCounts: total.tokenCounts,
    costUsd,
    averageCostUsd: averageOf(costUsd, launches),
    series: seriesRows.map((row) => ({
      day: text(row['day']),
      launches: Number(row['launches']),
    })),
    sessions,
    projects: projects.options(),
  };
}

function buildSessions(
  usageRows: Row[],
  launchRows: Row[],
  names: ProjectNames,
): SkillSession[] {
  const bySession = new Map<string, Usage>();
  for (const row of usageRows) {
    const id = text(row['session_id']);
    bySession.set(id, addUsage(bySession.get(id) ?? emptyUsage(), row));
  }
  return launchRows
    .map((row) => {
      const id = text(row['id']);
      const usage = bySession.get(id) ?? emptyUsage();
      return {
        id,
        title: text(row['title']),
        project: text(row['project']),
        projectName: names.label(text(row['project'])),
        launches: Number(row['launches']),
        tokens: usage.tokens,
        tokenCounts: usage.tokenCounts,
        costUsd: costOrZero(usage),
      };
    })
    .sort(byCostDescending((row) => row.id));
}
