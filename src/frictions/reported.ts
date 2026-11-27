import { desc, eq } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import {
  type ReportFilters,
  type ReportedGroup,
  markedReport,
} from '../db/schema.ts';
import type { Period } from '../overview/types.ts';
import type { ReportGroup } from './report-groups.ts';

export interface EarlierReport {
  id: number;
  reportedAt: Date;
  groups: ReportedGroup[];
}

export type GroupStatus =
  | { kind: 'new' }
  | { kind: 'reported'; reportedAt: string; times: number; since: number };

export interface NotSeenGroup {
  key: string;
  reportedAt: string;
  frictions: number;
}

export interface TaggedGroups {
  groups: ReportGroup[];
  statuses: Map<string, GroupStatus>;
  notSeen: NotSeenGroup[];
}

export interface NewReport {
  project: string;
  reportedAt: Date;
  period: Period;
  filters: ReportFilters;
  groups: ReportedGroup[];
}

export async function earlierReports(
  db: Database,
  project: string,
): Promise<EarlierReport[]> {
  return db
    .select({
      id: markedReport.id,
      reportedAt: markedReport.reportedAt,
      groups: markedReport.groups,
    })
    .from(markedReport)
    .where(eq(markedReport.project, project));
}

export async function lastReportAt(
  db: Database,
  project: string | undefined,
): Promise<string | null> {
  if (project === undefined) return null;
  const [latest] = await db
    .select({ reportedAt: markedReport.reportedAt })
    .from(markedReport)
    .where(eq(markedReport.project, project))
    .orderBy(desc(markedReport.reportedAt), desc(markedReport.id))
    .limit(1);
  return latest === undefined ? null : latest.reportedAt.toISOString();
}

export async function recordReport(
  db: Database,
  report: NewReport,
): Promise<void> {
  await db.insert(markedReport).values(report);
}

function later(left: EarlierReport, right: EarlierReport): boolean {
  const moment = left.reportedAt.getTime() - right.reportedAt.getTime();
  return moment > 0 || (moment === 0 && left.id > right.id);
}

interface Held {
  latest: EarlierReport;
  times: number;
}

function heldByKey(reports: readonly EarlierReport[]): Map<string, Held> {
  const held = new Map<string, Held>();
  for (const report of reports) {
    for (const key of new Set(report.groups.map((group) => group.key))) {
      const known = held.get(key);
      held.set(key, {
        latest:
          known === undefined || later(report, known.latest)
            ? report
            : known.latest,
        times: (known?.times ?? 0) + 1,
      });
    }
  }
  return held;
}

export function rowsSince(group: ReportGroup, since: Date): ReportGroup {
  const rows = group.rows.filter((row) => Date.parse(row.at) > since.getTime());
  return { ...group, rows };
}

export function tagGroups(
  groups: readonly ReportGroup[],
  reports: readonly EarlierReport[],
): TaggedGroups {
  const held = heldByKey(reports);
  const statuses = new Map<string, GroupStatus>();
  const fresh: ReportGroup[] = [];
  const reported: ReportGroup[] = [];
  const notSeen: NotSeenGroup[] = [];
  for (const group of groups) {
    const known = held.get(group.key);
    if (known === undefined) {
      statuses.set(group.key, { kind: 'new' });
      fresh.push(group);
      continue;
    }
    const reportedAt = known.latest.reportedAt.toISOString();
    const since = rowsSince(group, known.latest.reportedAt).rows.length;
    if (since === 0) {
      notSeen.push({
        key: group.key,
        reportedAt,
        frictions: group.rows.length,
      });
      continue;
    }
    statuses.set(group.key, {
      kind: 'reported',
      reportedAt,
      times: known.times,
      since,
    });
    reported.push(group);
  }
  return { groups: [...fresh, ...reported], statuses, notSeen };
}
