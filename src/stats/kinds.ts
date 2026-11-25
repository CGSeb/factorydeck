import type { Database } from '../db/client.ts';
import { type IssueKind, kindOf } from '../git-host/kind.ts';
import {
  type AutonomyQuery,
  type FactoryFilter,
  type IssueFacts,
  type Window,
  issueFacts,
  loadIssues,
  mergedIn,
} from './autonomy.ts';
import { earliestMerge, statsBounds } from './bounds.ts';

export function mergedKinds(
  issues: readonly (IssueFacts & { kind: IssueKind })[],
  window: Window,
): Record<IssueKind, number> {
  const counts: Record<IssueKind, number> = { feature: 0, bug: 0 };
  for (const issue of mergedIn(issues, window)) counts[issue.kind] += 1;
  return counts;
}

export async function mergedByKind(
  db: Database,
  query: AutonomyQuery,
  hasFactory: FactoryFilter,
): Promise<Record<IssueKind, number>> {
  const issues = await loadIssues(
    db,
    query.project,
    hasFactory,
    (issue, requests, state) => ({
      ...issueFacts(issue, requests, state),
      kind: kindOf(issue, state.bugLabel),
    }),
  );
  const bounds = await statsBounds(db, {
    ...query,
    earliestMerge: earliestMerge(issues),
  });
  return mergedKinds(issues, { from: bounds.start, to: null });
}
