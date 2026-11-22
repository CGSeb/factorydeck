import { sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { text } from '../features/values.ts';
import { select } from '../overview/query.ts';
import type { Period } from '../overview/types.ts';

export const TREND_WEEKS = 12;

export interface BoundsQuery {
  period: Period;
  timeZone: string;
  now?: Date;
}

export interface StatsBounds {
  start: number | null;
  previousStart: number | null;
  weeks: { start: number; day: string }[];
}

const PERIOD_DAYS: Record<Exclude<Period, 'all'>, number> = {
  today: 1,
  '7d': 7,
  '30d': 30,
};

const UTC_FORMAT = 'YYYY-MM-DD"T"HH24:MI:SS"Z"';

export async function statsBounds(
  db: Database,
  { period, timeZone, now = new Date() }: BoundsQuery,
): Promise<StatsBounds> {
  const days = period === 'all' ? 0 : PERIOD_DAYS[period];
  const [periods] = await select(
    db,
    sql`with t as (
        select date_trunc('day', ${now.toISOString()}::timestamptz at time zone ${timeZone}) as today
      )
      select
        to_char((today - ${days - 1} * interval '1 day') at time zone ${timeZone}
          at time zone 'UTC', ${UTC_FORMAT}) as start,
        to_char((today - ${2 * days - 1} * interval '1 day') at time zone ${timeZone}
          at time zone 'UTC', ${UTC_FORMAT}) as previous
      from t`,
  );
  const weeks = await select(
    db,
    sql`with t as (
        select date_trunc('week', ${now.toISOString()}::timestamptz at time zone ${timeZone}) as monday
      )
      select
        to_char(monday - (${TREND_WEEKS - 1} - i) * interval '1 week', 'YYYY-MM-DD') as day,
        to_char((monday - (${TREND_WEEKS - 1} - i) * interval '1 week') at time zone ${timeZone}
          at time zone 'UTC', ${UTC_FORMAT}) as start
      from t, generate_series(0, ${TREND_WEEKS - 1}) as i
      order by i`,
  );
  return {
    start: period === 'all' ? null : Date.parse(text(periods?.['start'])),
    previousStart:
      period === 'all' ? null : Date.parse(text(periods?.['previous'])),
    weeks: weeks.map((row) => ({
      start: Date.parse(text(row['start'])),
      day: text(row['day']),
    })),
  };
}
