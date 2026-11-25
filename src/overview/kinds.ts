import { bugCounts } from '../bugs/query.ts';
import type { Database } from '../db/client.ts';
import type { FactoryFilter } from '../stats/autonomy.ts';
import { mergedByKind } from '../stats/kinds.ts';
import { type OverviewQuery, usageOverview } from './query.ts';
import type { OverviewData, OverviewKinds } from './types.ts';

export async function overviewKinds(
  db: Database,
  query: OverviewQuery,
  hasFactory: FactoryFilter,
): Promise<OverviewKinds> {
  const [merged, bugs] = await Promise.all([
    mergedByKind(db, query, hasFactory),
    bugCounts(db, query.project),
  ]);
  return { merged, openBugs: bugs.counts.open, bugTickets: bugs.bugTickets };
}

export async function overviewData(
  db: Database,
  query: OverviewQuery,
  hasFactory: FactoryFilter,
): Promise<OverviewData> {
  const [usage, kinds] = await Promise.all([
    usageOverview(db, query),
    overviewKinds(db, query, hasFactory),
  ]);
  return { ...usage, ...kinds };
}
