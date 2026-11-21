import { type SQL, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { costOf, modelFamily } from '../pricing.ts';
import {
  FAMILIES,
  type Family,
  type ModelUsage,
  type Period,
  type ProjectUsage,
  type SeriesPoint,
  type TokenCounts,
  type UsageOverview,
} from './types.ts';

export interface OverviewQuery {
  period: Period;
  timeZone: string;
  now?: Date;
}

type Row = Record<string, unknown>;

interface UsageRow extends TokenCounts {
  model: string;
  calls: number;
}

interface Window {
  unit: UsageOverview['bucket'];
  format: string;
  timeZone: string;
  nowAt: string;
  startAt: string | null;
}

const DAYS_BEFORE_TODAY: Record<Exclude<Period, 'all'>, number> = {
  today: 0,
  '7d': 6,
  '30d': 29,
};

const USAGE_COLUMNS = sql`
  a.model,
  count(*) as calls,
  sum(a.input_tokens) as input,
  sum(a.cache_write_tokens) as cache_write,
  sum(a.cache_read_tokens) as cache_read,
  sum(a.output_tokens) as output`;

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null;
}

export async function select(db: Database, query: SQL): Promise<Row[]> {
  const result: unknown = await db.execute(query);
  const rows: unknown =
    isRow(result) && 'rows' in result ? result.rows : result;
  return Array.isArray(rows) ? rows.filter(isRow) : [];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function usageOf(row: Row): UsageRow {
  return {
    model: text(row['model']),
    calls: Number(row['calls']),
    input: Number(row['input']),
    cacheWrite: Number(row['cache_write']),
    cacheRead: Number(row['cache_read']),
    output: Number(row['output']),
  };
}

function totalTokens(counts: TokenCounts): number {
  return counts.input + counts.cacheWrite + counts.cacheRead + counts.output;
}

function addCost(
  total: number | null,
  cost: number | undefined,
): number | null {
  return cost === undefined ? total : (total ?? 0) + cost;
}

export function byCostDescending<
  T extends { costUsd: number | null; tokens: number },
>(name: (row: T) => string): (left: T, right: T) => number {
  return (left, right) =>
    (right.costUsd ?? -1) - (left.costUsd ?? -1) ||
    right.tokens - left.tokens ||
    name(left).localeCompare(name(right));
}

async function windowOf(
  db: Database,
  { period, timeZone, now = new Date() }: OverviewQuery,
): Promise<Window> {
  const unit = period === 'today' ? 'hour' : 'day';
  const format = unit === 'hour' ? 'YYYY-MM-DD"T"HH24:00' : 'YYYY-MM-DD';
  const nowAt = now.toISOString();
  const startAt = await periodStart(db, { period, timeZone, now });
  return { unit, format, timeZone, nowAt, startAt };
}

export async function periodStart(
  db: Database,
  { period, timeZone, now = new Date() }: OverviewQuery,
): Promise<string | null> {
  if (period === 'all') return null;
  const [row] = await select(
    db,
    sql`select to_char(
        (date_trunc('day', ${now.toISOString()}::timestamptz at time zone ${timeZone})
          - ${DAYS_BEFORE_TODAY[period]} * interval '1 day') at time zone ${timeZone}
          at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS"Z"') as start`,
  );
  return text(row?.['start']);
}

function inWindow({ startAt }: Window): SQL {
  return sql`(${startAt}::timestamptz is null or a.at >= ${startAt}::timestamptz)`;
}

function bucketsQuery(window: Window): SQL {
  const { unit, format, timeZone, nowAt, startAt } = window;
  return sql`with bounds as (
      select
        date_trunc(${unit}, coalesce(${startAt}::timestamptz, min(a.at)) at time zone ${timeZone}) as first,
        date_trunc(${unit}, greatest(${nowAt}::timestamptz, max(a.at)) at time zone ${timeZone}) as last
      from api_call a where ${inWindow(window)}
    )
    select to_char(step, ${format}) as bucket
    from bounds, generate_series(bounds.first, bounds.last, ('1 ' || ${unit})::interval) as step
    where bounds.first is not null
    order by step`;
}

function usageByBucketQuery(window: Window): SQL {
  const { unit, format, timeZone } = window;
  return sql`select to_char(date_trunc(${unit}, a.at at time zone ${timeZone}), ${format}) as bucket,
      ${USAGE_COLUMNS}
    from api_call a where ${inWindow(window)} group by 1, a.model`;
}

function usageByProjectQuery(window: Window): SQL {
  return sql`select s.project, ${USAGE_COLUMNS}
    from api_call a join session s on s.id = a.session_id
    where ${inWindow(window)} group by s.project, a.model`;
}

function sessionsByProjectQuery(window: Window): SQL {
  return sql`select s.project, count(distinct a.session_id) as sessions
    from api_call a join session s on s.id = a.session_id
    where ${inWindow(window)} group by rollup (s.project)`;
}

function emptyTotals(): UsageOverview['totals'] {
  return {
    costUsd: 0,
    unknownPriceCalls: 0,
    tokens: { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 },
    sessions: 0,
    apiCalls: 0,
  };
}

function addToTotals(
  totals: UsageOverview['totals'],
  usage: UsageRow,
  cost: number | undefined,
): void {
  totals.tokens.input += usage.input;
  totals.tokens.cacheWrite += usage.cacheWrite;
  totals.tokens.cacheRead += usage.cacheRead;
  totals.tokens.output += usage.output;
  totals.apiCalls += usage.calls;
  if (cost === undefined) totals.unknownPriceCalls += usage.calls;
  else totals.costUsd += cost;
}

interface Usage {
  apiCalls: number;
  tokens: number;
  costUsd: number | null;
}

function addTo<T extends Usage>(
  row: T,
  usage: UsageRow,
  cost: number | undefined,
): T {
  row.apiCalls += usage.calls;
  row.tokens += totalTokens(usage);
  row.costUsd = addCost(row.costUsd, cost);
  return row;
}

const NO_USAGE: Usage = { apiCalls: 0, tokens: 0, costUsd: null };

function summarize(
  projectRows: Row[],
  sessionRows: Row[],
): Pick<UsageOverview, 'totals' | 'projects' | 'models'> {
  const totals = emptyTotals();
  const models = new Map<string, ModelUsage>();
  const projects = new Map<string, ProjectUsage>();
  for (const raw of projectRows) {
    const usage = usageOf(raw);
    const project = text(raw['project']);
    const cost = costOf(usage.model, usage);
    addToTotals(totals, usage, cost);
    const model = models.get(usage.model) ?? {
      model: usage.model,
      ...NO_USAGE,
    };
    models.set(usage.model, addTo(model, usage, cost));
    const row = projects.get(project) ?? { project, sessions: 0, ...NO_USAGE };
    projects.set(project, addTo(row, usage, cost));
  }
  for (const raw of sessionRows) {
    const count = Number(raw['sessions']);
    const project = projects.get(text(raw['project']));
    if (raw['project'] === null) totals.sessions = count;
    else if (project) project.sessions = count;
  }
  return {
    totals,
    projects: [...projects.values()].sort(
      byCostDescending((row) => row.project),
    ),
    models: [...models.values()].sort(byCostDescending((row) => row.model)),
  };
}

function familyOf(model: string): Family {
  return FAMILIES.find((name) => name === modelFamily(model)) ?? 'other';
}

function buildSeries(bucketRows: Row[], usageRows: Row[]): SeriesPoint[] {
  const points = new Map<string, SeriesPoint>(
    bucketRows.map((raw) => {
      const bucket = text(raw['bucket']);
      return [bucket, { bucket, opus: 0, sonnet: 0, haiku: 0, other: 0 }];
    }),
  );
  for (const raw of usageRows) {
    const usage = usageOf(raw);
    const point = points.get(text(raw['bucket']));
    if (point) point[familyOf(usage.model)] += costOf(usage.model, usage) ?? 0;
  }
  return [...points.values()];
}

export async function usageOverview(
  db: Database,
  query: OverviewQuery,
): Promise<UsageOverview> {
  const window = await windowOf(db, query);
  const [hasData, projectRows, sessionRows, bucketRows, usageRows] =
    await Promise.all([
      select(db, sql`select exists(select 1 from session) as has_data`),
      select(db, usageByProjectQuery(window)),
      select(db, sessionsByProjectQuery(window)),
      select(db, bucketsQuery(window)),
      select(db, usageByBucketQuery(window)),
    ]);
  return {
    hasData: hasData[0]?.['has_data'] === true,
    bucket: window.unit,
    ...summarize(projectRows, sessionRows),
    series: buildSeries(bucketRows, usageRows),
  };
}
