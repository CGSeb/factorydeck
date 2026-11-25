import { useMemo } from 'react';
import type { IssueKind } from '../git-host/kind.ts';
import type {
  AutonomyResponse,
  BugResponse,
  FlowResponse,
  QualityResponse,
} from '../stats/types.ts';
import { type SkillFilters, useRefreshing } from './skills-api.ts';
import type {
  LoadAutonomy,
  LoadBugStats,
  LoadFlow,
  LoadQuality,
} from './stats-api.ts';

export interface StatsLoaders {
  loadAutonomy: LoadAutonomy;
  loadQuality: LoadQuality;
  loadFlow: LoadFlow;
  loadBugStats: LoadBugStats;
}

export interface StatsData {
  autonomy: AutonomyResponse | undefined;
  quality: QualityResponse | undefined;
  flow: FlowResponse | undefined;
  bugs: BugResponse | undefined;
  bugTickets: boolean;
  kind: IssueKind | null;
}

const SCOPE = 'stats';

function useKindOf(
  loadBugStats: LoadBugStats,
  filters: SkillFilters,
  wanted: IssueKind | null,
): Promise<IssueKind | null> {
  const key = JSON.stringify({ ...filters, wanted });
  return useMemo(async () => {
    if (wanted === null) return null;
    const response = await loadBugStats(filters);
    return response?.status === 'ok' && response.bugs.bugTickets
      ? wanted
      : null;
  }, [key]);
}

export function useStatsData(
  { loadAutonomy, loadQuality, loadFlow, loadBugStats }: StatsLoaders,
  filters: SkillFilters,
  wanted: IssueKind | null,
): StatsData {
  const bugs = useRefreshing(
    JSON.stringify(filters),
    () => loadBugStats(filters),
    SCOPE,
  );
  const kindOf = useKindOf(loadBugStats, filters, wanted);
  const key = JSON.stringify({ ...filters, kind: wanted });
  const autonomy = useRefreshing(
    key,
    async () => loadAutonomy(filters, await kindOf),
    SCOPE,
  );
  const quality = useRefreshing(
    key,
    async () => loadQuality(filters, await kindOf),
    SCOPE,
  );
  const flow = useRefreshing(
    key,
    async () => loadFlow(filters, await kindOf),
    SCOPE,
  );
  const bugTickets = bugs?.status === 'ok' && bugs.bugs.bugTickets;
  return {
    autonomy,
    quality,
    flow,
    bugs,
    bugTickets,
    kind: bugTickets ? wanted : null,
  };
}

export function showsBugsPanel({ bugs, bugTickets, kind }: StatsData): boolean {
  return (bugs?.status === 'unreachable' || bugTickets) && kind !== 'feature';
}
