import type { Database } from '../db/client.ts';
import { type IssueKind, kindOf } from '../git-host/kind.ts';
import { outcomeOf } from '../git-host/query.ts';
import { type FactoryFilter, loadIssues } from '../stats/autonomy.ts';
import type { ReadyCounts } from './types.ts';

export async function readyCounts(
  db: Database,
  project: string | undefined,
  hasFactory: FactoryFilter,
): Promise<ReadyCounts> {
  const kinds = await loadIssues(
    db,
    project,
    hasFactory,
    (issue, requests, state): IssueKind | null =>
      outcomeOf(issue, requests, state).stage === 'ready'
        ? kindOf(issue, state.bugLabel)
        : null,
  );
  return {
    feature: kinds.filter((kind) => kind === 'feature').length,
    bug: kinds.filter((kind) => kind === 'bug').length,
  };
}
