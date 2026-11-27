import { homedir } from 'node:os';
import type { Database } from '../db/client.ts';
import type { WorkflowConfig } from '../roles/config.ts';
import { type ReportQuery, buildReport } from './report.ts';
import { earlierReports, recordReport } from './reported.ts';

export async function markFrictionReport(
  db: Database,
  query: ReportQuery,
  config: WorkflowConfig,
  home: string = homedir(),
): Promise<string> {
  const reports = await earlierReports(db, query.project);
  const built = await buildReport(db, query, config, { home, reports });
  await recordReport(db, {
    project: query.project,
    reportedAt: new Date(built.now),
    period: query.period,
    filters: {
      kind: query.kind ?? null,
      role: query.role ?? null,
      session: query.filter?.session ?? null,
      issue: query.filter?.issue ?? null,
    },
    groups: built.groups.map((group) => ({
      key: group.key,
      frictions: group.rows.length,
    })),
  });
  return built.markdown;
}
