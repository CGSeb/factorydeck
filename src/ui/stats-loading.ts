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

function waiting<T>(): Promise<T | undefined> {
  return new Promise(() => undefined);
}

export function panelKind(
  wanted: IssueKind | null,
  bugs: BugResponse | undefined,
): IssueKind | null | undefined {
  if (wanted === null) return null;
  if (bugs === undefined) return undefined;
  return bugs.status === 'ok' && bugs.bugs.bugTickets ? wanted : null;
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
  const kind = panelKind(wanted, bugs);
  const key = JSON.stringify({
    ...filters,
    kind: kind ?? null,
    ready: kind !== undefined,
  });
  const autonomy = useRefreshing(
    key,
    () => (kind === undefined ? waiting() : loadAutonomy(filters, kind)),
    SCOPE,
  );
  const quality = useRefreshing(
    key,
    () => (kind === undefined ? waiting() : loadQuality(filters, kind)),
    SCOPE,
  );
  const flow = useRefreshing(
    key,
    () => (kind === undefined ? waiting() : loadFlow(filters, kind)),
    SCOPE,
  );
  return {
    autonomy,
    quality,
    flow,
    bugs,
    bugTickets: bugs?.status === 'ok' && bugs.bugs.bugTickets,
    kind: kind ?? null,
  };
}

export function showsBugsPanel({ bugs, bugTickets, kind }: StatsData): boolean {
  return (bugs?.status === 'unreachable' || bugTickets) && kind !== 'feature';
}
