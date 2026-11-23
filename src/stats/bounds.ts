import { sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { text } from '../features/values.ts';
import { select } from '../overview/query.ts';
import type { Period } from '../overview/types.ts';
import type { TrendUnit } from './types.ts';

export const TREND_WEEKS = 12;
export const MAX_WEEK_SPAN = 26;
export const MAX_MONTH_BUCKETS = 36;

export interface BoundsQuery {
  period: Period;
  timeZone: string;
  now?: Date;
  earliestMerge?: number | null;
}

export interface TrendCut {
  start: number;
  key: string;
}

export interface StatsBounds {
  start: number | null;
  previousStart: number | null;
  weeks: { start: number; day: string }[];
  unit: TrendUnit;
  buckets: TrendCut[];
}

const PERIOD_DAYS: Record<Exclude<Period, 'all'>, number> = {
  today: 1,
  '7d': 7,
  '30d': 30,
};

const UTC_FORMAT = 'YYYY-MM-DD"T"HH24:MI:SS"Z"';

interface Clock {
  now: Date;
  timeZone: string;
}

function cuts(rows: Record<string, unknown>[]): TrendCut[] {
  return rows.map((row) => ({
    start: Date.parse(text(row['start'])),
    key: text(row['key']),
  }));
}

function hours(db: Database, now: Date, timeZone: string) {
  return select(
    db,
    sql`with t as (
        select date_trunc('day', ${now.toISOString()}::timestamptz at time zone ${timeZone}) as day
      )
      select
        to_char(h at time zone ${timeZone}, 'YYYY-MM-DD"T"HH24:MI') as key,
        to_char(h at time zone 'UTC', ${UTC_FORMAT}) as start
      from t, generate_series(
        day at time zone ${timeZone},
        (day + interval '1 day') at time zone ${timeZone} - interval '1 hour',
        interval '1 hour'
      ) as h
      order by h`,
  );
}

function days(db: Database, now: Date, timeZone: string, count: number) {
  return select(
    db,
    sql`with t as (
        select date_trunc('day', ${now.toISOString()}::timestamptz at time zone ${timeZone}) as today
      )
      select
        to_char(d, 'YYYY-MM-DD') as key,
        to_char(d at time zone ${timeZone} at time zone 'UTC', ${UTC_FORMAT}) as start
      from t, generate_series(
        today - ${count - 1} * interval '1 day', today, interval '1 day'
      ) as d
      order by d`,
  );
}

async function spans(
  db: Database,
  now: Date,
  timeZone: string,
  earliest: number,
): Promise<{ weeks: number; months: number }> {
  const [row] = await select(
    db,
    sql`with t as (
        select
          ${new Date(earliest).toISOString()}::timestamptz at time zone ${timeZone} as first,
          ${now.toISOString()}::timestamptz at time zone ${timeZone} as last
      )
      select
        (date_trunc('week', last)::date - date_trunc('week', first)::date) / 7 as weeks,
        (extract(year from last) - extract(year from first)) * 12
          + extract(month from last) - extract(month from first) as months
      from t`,
  );
  return { weeks: Number(row?.['weeks']), months: Number(row?.['months']) };
}

function calendar(
  db: Database,
  { now, timeZone }: Clock,
  unit: 'week' | 'month' | 'year',
  earliest: number | null,
) {
  const first = earliest === null ? null : new Date(earliest).toISOString();
  return select(
    db,
    sql`with t as (
        select date_trunc(${unit}, ${now.toISOString()}::timestamptz at time zone ${timeZone}) as last
      ), f as (
        select last, least(last, coalesce(
          date_trunc(${unit}, ${first}::timestamptz at time zone ${timeZone}),
          last - ${TREND_WEEKS - 1} * interval '1 week'
        )) as first
        from t
      )
      select
        to_char(b, 'YYYY-MM-DD') as key,
        to_char(b at time zone ${timeZone} at time zone 'UTC', ${UTC_FORMAT}) as start
      from f, generate_series(first, last, ${`1 ${unit}`}::interval) as b
      order by b`,
  );
}

async function allTimeUnit(
  db: Database,
  now: Date,
  timeZone: string,
  earliest: number | null,
): Promise<'week' | 'month' | 'year'> {
  if (earliest === null) return 'week';
  const { weeks, months } = await spans(db, now, timeZone, earliest);
  if (weeks <= MAX_WEEK_SPAN) return 'week';
  return months + 1 <= MAX_MONTH_BUCKETS ? 'month' : 'year';
}

async function trendCut(
  db: Database,
  { period, timeZone, now = new Date(), earliestMerge = null }: BoundsQuery,
): Promise<{ unit: TrendUnit; buckets: TrendCut[] }> {
  if (period === 'today') {
    return { unit: 'hour', buckets: cuts(await hours(db, now, timeZone)) };
  }
  if (period !== 'all') {
    return {
      unit: 'day',
      buckets: cuts(await days(db, now, timeZone, PERIOD_DAYS[period])),
    };
  }
  const unit = await allTimeUnit(db, now, timeZone, earliestMerge);
  return {
    unit,
    buckets: cuts(await calendar(db, { now, timeZone }, unit, earliestMerge)),
  };
}

export function earliestMerge(
  issues: readonly { mergedAt: number | null }[],
): number | null {
  let found: number | null = null;
  for (const { mergedAt } of issues) {
    if (mergedAt !== null && (found === null || mergedAt < found)) {
      found = mergedAt;
    }
  }
  return found;
}

export async function statsBounds(
  db: Database,
  query: BoundsQuery,
): Promise<StatsBounds> {
  const { period, timeZone, now = new Date() } = query;
  const periodDays = period === 'all' ? 0 : PERIOD_DAYS[period];
  const [periods] = await select(
    db,
    sql`with t as (
        select date_trunc('day', ${now.toISOString()}::timestamptz at time zone ${timeZone}) as today
      )
      select
        to_char((today - ${periodDays - 1} * interval '1 day') at time zone ${timeZone}
          at time zone 'UTC', ${UTC_FORMAT}) as start,
        to_char((today - ${2 * periodDays - 1} * interval '1 day') at time zone ${timeZone}
          at time zone 'UTC', ${UTC_FORMAT}) as previous
      from t`,
  );
  const [weeks, cut] = await Promise.all([
    calendar(db, { now, timeZone }, 'week', null),
    trendCut(db, { ...query, now }),
  ]);
  return {
    start: period === 'all' ? null : Date.parse(text(periods?.['start'])),
    previousStart:
      period === 'all' ? null : Date.parse(text(periods?.['previous'])),
    weeks: cuts(weeks).map(({ start, key }) => ({ start, day: key })),
    ...cut,
  };
}
