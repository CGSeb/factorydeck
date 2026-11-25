import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { gitHostIssue, gitHostRequest } from '../db/schema.ts';
import type { IssueKind } from '../git-host/kind.ts';
import { countedRequest } from '../git-host/outcome.ts';
import {
  type RequestRow,
  outcomeRequest,
} from '../git-host/outcome-request.ts';
import type { BugFix } from './types.ts';
import { currentVersion, versionOfRequest, versionsOf } from './versions.ts';

export function bugFix(requests: readonly RequestRow[]): BugFix | null {
  const counted = countedRequest(
    requests.map((row) => ({
      ...outcomeRequest(row),
      number: row.number,
      url: row.url,
    })),
  );
  const report = counted?.report;
  if (counted === undefined || report == null) return null;
  return {
    rootCause: report.rootCause ?? null,
    reproduced: report.reproduced ?? null,
    request: { number: counted.number, url: counted.url },
  };
}

async function issueFix(
  db: Database,
  project: string,
  number: number,
): Promise<BugFix | null> {
  const [[issue], requests] = await Promise.all([
    db
      .select()
      .from(gitHostIssue)
      .where(
        and(eq(gitHostIssue.project, project), eq(gitHostIssue.number, number)),
      ),
    db
      .select()
      .from(gitHostRequest)
      .where(
        and(
          eq(gitHostRequest.project, project),
          sql`${gitHostRequest.closes} @> ${JSON.stringify([number])}::jsonb`,
        ),
      ),
  ]);
  if (issue === undefined) return null;
  const versions = versionsOf(issue);
  const current = currentVersion(versions).number;
  return bugFix(
    requests.filter(
      (request) => versionOfRequest(versions, request) === current,
    ),
  );
}

export function bugFixOf(
  db: Database,
  { project, number }: { project: string; number: number },
  kind: IssueKind | null,
): Promise<BugFix | null> {
  return kind === 'bug' ? issueFix(db, project, number) : Promise.resolve(null);
}
