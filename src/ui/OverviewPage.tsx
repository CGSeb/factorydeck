import type { ReactElement } from 'react';
import type { FeatureList } from '../features/types.ts';
import type { UsageOverview } from '../overview/types.ts';
import type { RoleList } from '../roles/types.ts';
import { DayBars } from './components/DayBars.tsx';
import { PageHeader } from './components/PageHeader.tsx';
import { Panel } from './components/Panel.tsx';
import { PeriodPills } from './components/PeriodPills.tsx';
import { SplitBar } from './components/SplitBar.tsx';
import { SplitLegend } from './components/SplitLegend.tsx';
import { StageColumn } from './components/StageColumn.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { TokenAmount } from './components/TokenAmount.tsx';
import type { LoadFeatures } from './features-api.ts';
import { renderRouterLink } from './Layout.tsx';
import {
  boardColumns,
  headlineCount,
  headlineSummary,
  listPath,
  roleSegments,
  tokenBuckets,
} from './overview-board.ts';
import { type LoadOverview, UNREACHABLE_MESSAGE } from './overview-api.ts';
import type { LoadRoles } from './roles-api.ts';
import {
  type SkillFilters,
  useRefreshing,
  useSkillFilters,
} from './skills-api.ts';
import './overview-page.css';

export interface OverviewPageProps {
  loadOverview: LoadOverview;
  loadFeatures: LoadFeatures;
  loadRoles: LoadRoles;
}

type Block<T> = T | 'loading' | 'unreachable';

function blockOf<T>(
  response: { status: string } | undefined,
  value: T | undefined,
): Block<T> {
  if (value !== undefined) return value;
  return response === undefined ? 'loading' : 'unreachable';
}

function BlockStatus({
  block,
}: {
  block: 'loading' | 'unreachable';
}): ReactElement {
  return (
    <StatusLine>
      {block === 'loading' ? 'Loading…' : UNREACHABLE_MESSAGE}
    </StatusLine>
  );
}

function Headline({
  overview,
  merged,
}: {
  overview: UsageOverview;
  merged: number;
}): ReactElement {
  const { totals } = overview;
  return (
    <>
      {headlineCount(merged)}
      <TokenAmount
        counts={totals.tokens}
        costUsd={totals.costUsd}
        unknownPriceCalls={totals.unknownPriceCalls}
        placement="below"
      />{' '}
      tokens
    </>
  );
}

function Header({
  overview,
  features,
  filters,
  setFilters,
}: {
  overview: Block<UsageOverview>;
  features: Block<FeatureList>;
  filters: SkillFilters;
  setFilters: (next: SkillFilters) => void;
}): ReactElement {
  const pills = (
    <PeriodPills
      value={filters.period}
      onChange={(period) => setFilters({ ...filters, period })}
    />
  );
  if (typeof overview === 'string' || typeof features === 'string') {
    const block =
      overview === 'unreachable' || features === 'unreachable'
        ? 'unreachable'
        : 'loading';
    return (
      <PageHeader
        variant="headline"
        title="Overview"
        summary={block === 'loading' ? 'Loading…' : UNREACHABLE_MESSAGE}
        slot={pills}
      />
    );
  }
  return (
    <PageHeader
      variant="headline"
      title={<Headline overview={overview} merged={features.merged.issues} />}
      summary={headlineSummary(features.merged, overview.totals.sessions)}
      slot={pills}
    />
  );
}

function Board({
  features,
  filters,
}: {
  features: Block<FeatureList>;
  filters: SkillFilters;
}): ReactElement {
  return (
    <section aria-label="Board" className="fd-overview-board">
      {typeof features === 'string' ? (
        <BlockStatus block={features} />
      ) : (
        boardColumns(features, filters).map((column) => (
          <StageColumn
            key={column.group}
            {...column}
            renderLink={renderRouterLink}
          />
        ))
      )}
    </section>
  );
}

function TokensPanel({
  overview,
  roles,
  filters,
}: {
  overview: Block<UsageOverview>;
  roles: Block<RoleList>;
  filters: SkillFilters;
}): ReactElement {
  return (
    <Panel
      heading="Where the tokens went"
      link={{ label: 'Roles', href: listPath('/roles', filters) }}
      renderLink={renderRouterLink}
    >
      {typeof overview === 'string' || typeof roles === 'string' ? (
        <BlockStatus
          block={
            overview === 'unreachable' || roles === 'unreachable'
              ? 'unreachable'
              : 'loading'
          }
        />
      ) : (
        <TokensSplit overview={overview} roles={roles} />
      )}
    </Panel>
  );
}

function TokensSplit({
  overview,
  roles,
}: {
  overview: UsageOverview;
  roles: RoleList;
}): ReactElement {
  const segments = roleSegments(roles);
  const chartTitle =
    overview.bucket === 'hour' ? 'Tokens per hour' : 'Tokens per day';
  return (
    <div className="fd-overview-tokens">
      <div className="fd-overview-roles">
        <SplitBar label="Tokens by role" height="medium" segments={segments} />
        <SplitLegend segments={segments} />
      </div>
      <div className="fd-overview-days">
        <span className="fd-overview-days-title">{chartTitle}</span>
        <DayBars
          label={chartTitle}
          buckets={tokenBuckets(overview.series)}
          color="var(--fd-ink)"
          height={56}
        />
      </div>
    </div>
  );
}

export function OverviewPage({
  loadOverview,
  loadFeatures,
  loadRoles,
}: OverviewPageProps): ReactElement {
  const [filters, setFilters] = useSkillFilters();
  const key = JSON.stringify(filters);
  const overviewResponse = useRefreshing(key, () =>
    loadOverview(filters.period, filters.project),
  );
  const featuresResponse = useRefreshing(key, () => loadFeatures(filters));
  const rolesResponse = useRefreshing(key, () => loadRoles(filters));
  const overview = blockOf(
    overviewResponse,
    overviewResponse?.status === 'ok' ? overviewResponse.overview : undefined,
  );
  const features = blockOf(
    featuresResponse,
    featuresResponse?.status === 'ok' ? featuresResponse.list : undefined,
  );
  const roles = blockOf(
    rolesResponse,
    rolesResponse?.status === 'ok' ? rolesResponse.list : undefined,
  );
  const noActivity =
    typeof overview !== 'string' && overview.totals.apiCalls === 0;

  return (
    <div className="fd-overview">
      <Header
        overview={overview}
        features={features}
        filters={filters}
        setFilters={setFilters}
      />
      {noActivity ? (
        <StatusLine>No activity in this period.</StatusLine>
      ) : (
        <>
          <Board features={features} filters={filters} />
          <TokensPanel overview={overview} roles={roles} filters={filters} />
        </>
      )}
    </div>
  );
}
