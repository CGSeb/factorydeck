import { type ReactElement, useState } from 'react';
import type { UsageOverview } from '../overview/types.ts';
import type { RoleList } from '../roles/types.ts';
import type { AutonomyResponse, FlowResponse } from '../stats/types.ts';
import { PageHeader } from './components/PageHeader.tsx';
import { PeriodPills } from './components/PeriodPills.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { TokenAmount } from './components/TokenAmount.tsx';
import { totalTokens } from './components/token-amount.ts';
import { type LoadFeatures, loadKindList } from './features-api.ts';
import { KIND_PARAM, useKindParam } from './kind-filter.ts';
import { renderRouterLink } from './Layout.tsx';
import { NeedsPersonPanel } from './NeedsPersonPanel.tsx';
import { OverviewBoard } from './OverviewBoard.tsx';
import { headlineCount, headlineSummary, listPath } from './overview-board.ts';
import { type LoadOverview, UNREACHABLE_MESSAGE } from './overview-api.ts';
import { OverviewHealth } from './OverviewHealth.tsx';
import type { LoadRoles } from './roles-api.ts';
import {
  type SkillFilters,
  useRefreshing,
  useSkillFilters,
} from './skills-api.ts';
import type {
  LoadAutonomy,
  LoadFlow,
  LoadQuality,
  LoadWaiting,
} from './stats-api.ts';
import { flowFigures } from './stats-view.ts';
import { type Block, TOKENS_TITLE, TokensDialog } from './TokensDialog.tsx';
import { useNow } from './use-now.ts';
import './overview-page.css';

export interface OverviewPageProps {
  loadOverview: LoadOverview;
  loadFeatures: LoadFeatures;
  loadRoles: LoadRoles;
  loadAutonomy: LoadAutonomy;
  loadQuality: LoadQuality;
  loadFlow: LoadFlow;
  loadWaiting: LoadWaiting;
  now?: Date | undefined;
}

function blockOf<T>(
  response: { status: string } | undefined,
  value: T | undefined,
): Block<T> {
  if (value !== undefined) return value;
  return response === undefined ? 'loading' : 'unreachable';
}

function Headline({
  overview,
  merged,
  onOpenTokens,
}: {
  overview: UsageOverview;
  merged: number;
  onOpenTokens: () => void;
}): ReactElement {
  const { totals } = overview;
  const spent = totalTokens(totals.tokens) > 0;
  return (
    <>
      {headlineCount(merged)}
      <TokenAmount
        counts={totals.tokens}
        costUsd={totals.costUsd}
        unknownPriceCalls={totals.unknownPriceCalls}
        placement="below"
        action={
          spent ? { label: TOKENS_TITLE, onClick: onOpenTokens } : undefined
        }
      />{' '}
      tokens
    </>
  );
}

function tokensPerIssue(flow: FlowResponse | undefined) {
  return flow?.status === 'ok'
    ? flowFigures(flow.flow.current.issues).tokens
    : undefined;
}

function Header({
  overview,
  autonomy,
  flow,
  filters,
  setFilters,
  onOpenTokens,
}: {
  overview: Block<UsageOverview>;
  autonomy: AutonomyResponse | undefined;
  flow: FlowResponse | undefined;
  filters: SkillFilters;
  setFilters: (next: SkillFilters) => void;
  onOpenTokens: () => void;
}): ReactElement {
  const pills = (
    <PeriodPills
      value={filters.period}
      onChange={(period) => setFilters({ ...filters, period })}
    />
  );
  if (typeof overview === 'string' || autonomy?.status !== 'ok') {
    const unreachable =
      overview === 'unreachable' || autonomy?.status === 'unreachable';
    return (
      <PageHeader
        variant="headline"
        title="Overview"
        summary={unreachable ? UNREACHABLE_MESSAGE : 'Loading…'}
        slot={pills}
      />
    );
  }
  return (
    <PageHeader
      variant="headline"
      title={
        <Headline
          overview={overview}
          merged={autonomy.autonomy.current.merged}
          onOpenTokens={onOpenTokens}
        />
      }
      summary={headlineSummary(tokensPerIssue(flow), overview.totals.sessions)}
      slot={pills}
    />
  );
}

function useOverviewData(
  {
    loadOverview,
    loadFeatures,
    loadRoles,
    loadAutonomy,
    loadQuality,
    loadFlow,
    loadWaiting,
  }: OverviewPageProps,
  filters: SkillFilters,
) {
  const [kind, setKind] = useKindParam();
  const key = JSON.stringify(filters);
  const scope = 'overview';
  const overview = useRefreshing(
    key,
    () => loadOverview(filters.period, filters.project),
    scope,
  );
  const features = useRefreshing(
    JSON.stringify({ ...filters, kind }),
    () => loadKindList(loadFeatures, filters, kind),
    scope,
  );
  const roles = useRefreshing(key, () => loadRoles(filters), scope);
  return {
    kind,
    setKind,
    overview: blockOf(
      overview,
      overview?.status === 'ok' ? overview.overview : undefined,
    ),
    features: blockOf(
      features,
      features?.status === 'ok' ? features.list : undefined,
    ),
    roles: blockOf<RoleList>(
      roles,
      roles?.status === 'ok' ? roles.list : undefined,
    ),
    autonomy: useRefreshing(key, () => loadAutonomy(filters), scope),
    quality: useRefreshing(key, () => loadQuality(filters), scope),
    flow: useRefreshing(key, () => loadFlow(filters), scope),
    waiting: useRefreshing(
      filters.project ?? '',
      () => loadWaiting(filters.project),
      scope,
    ),
  };
}

export function OverviewPage(props: OverviewPageProps): ReactElement {
  const [filters, setFilters] = useSkillFilters([KIND_PARAM]);
  const [tokensOpen, setTokensOpen] = useState(false);
  const now = useNow(props.now);
  const data = useOverviewData(props, filters);
  const { overview, features, roles, autonomy, quality, flow, waiting } = data;
  const noActivity =
    typeof overview !== 'string' && overview.totals.apiCalls === 0;
  return (
    <div className="fd-overview">
      <Header
        overview={overview}
        autonomy={autonomy}
        flow={flow}
        filters={filters}
        setFilters={setFilters}
        onOpenTokens={() => {
          setTokensOpen(true);
        }}
      />
      <OverviewHealth
        autonomy={autonomy}
        quality={quality}
        flow={flow}
        period={filters.period}
        statsHref={listPath('/stats', filters)}
        now={now}
        renderLink={renderRouterLink}
      />
      <NeedsPersonPanel
        response={waiting}
        filters={filters}
        now={now}
        renderLink={renderRouterLink}
      />
      {noActivity ? (
        <StatusLine>No activity in this period.</StatusLine>
      ) : (
        <OverviewBoard
          features={features}
          filters={filters}
          kind={data.kind}
          onKindChange={data.setKind}
          now={now}
        />
      )}
      {tokensOpen && (
        <TokensDialog
          overview={overview}
          roles={roles}
          rolesHref={listPath('/roles', filters)}
          onClose={() => {
            setTokensOpen(false);
          }}
          renderLink={renderRouterLink}
        />
      )}
    </div>
  );
}
