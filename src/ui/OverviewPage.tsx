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

interface OverviewData {
  overview: UsageOverview;
  features: FeatureList;
  roles: RoleList;
}

function Headline({ data }: { data: OverviewData }): ReactElement {
  const { totals } = data.overview;
  return (
    <>
      {headlineCount(data.features.merged.issues)}
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

function TokensPanel({
  data,
  filters,
}: {
  data: OverviewData;
  filters: SkillFilters;
}): ReactElement {
  const segments = roleSegments(data.roles);
  const chartTitle =
    data.overview.bucket === 'hour' ? 'Tokens per hour' : 'Tokens per day';
  return (
    <Panel
      heading="Where the tokens went"
      link={{ label: 'Roles', href: listPath('/roles', filters) }}
      renderLink={renderRouterLink}
    >
      <div className="fd-overview-tokens">
        <div className="fd-overview-roles">
          <SplitBar
            label="Tokens by role"
            height="medium"
            segments={segments}
          />
          <SplitLegend segments={segments} />
        </div>
        <div className="fd-overview-days">
          <span className="fd-overview-days-title">{chartTitle}</span>
          <DayBars
            label={chartTitle}
            buckets={tokenBuckets(data.overview.series)}
            color="var(--fd-ink)"
            height={56}
          />
        </div>
      </div>
    </Panel>
  );
}

function OverviewContent({
  data,
  filters,
}: {
  data: OverviewData;
  filters: SkillFilters;
}): ReactElement {
  if (data.overview.totals.apiCalls === 0) {
    return <StatusLine>No activity in this period.</StatusLine>;
  }
  return (
    <>
      <section aria-label="Board" className="fd-overview-board">
        {boardColumns(data.features, filters).map((column) => (
          <StageColumn
            key={column.group}
            {...column}
            renderLink={renderRouterLink}
          />
        ))}
      </section>
      <TokensPanel data={data} filters={filters} />
    </>
  );
}

export function OverviewPage({
  loadOverview,
  loadFeatures,
  loadRoles,
}: OverviewPageProps): ReactElement {
  const [filters, setFilters] = useSkillFilters();
  const key = JSON.stringify(filters);
  const overview = useRefreshing(key, () =>
    loadOverview(filters.period, filters.project),
  );
  const features = useRefreshing(key, () => loadFeatures(filters));
  const roles = useRefreshing(key, () => loadRoles(filters));
  const unreachable = [overview, features, roles].some(
    (response) => response?.status === 'unreachable',
  );
  const data: OverviewData | undefined =
    overview?.status === 'ok' &&
    features?.status === 'ok' &&
    roles?.status === 'ok'
      ? {
          overview: overview.overview,
          features: features.list,
          roles: roles.list,
        }
      : undefined;

  return (
    <div className="fd-overview">
      <PageHeader
        variant="headline"
        title={data === undefined ? 'Overview' : <Headline data={data} />}
        {...(data === undefined
          ? {}
          : {
              summary: headlineSummary(
                data.features.merged,
                data.overview.totals.sessions,
              ),
            })}
        slot={
          <PeriodPills
            value={filters.period}
            onChange={(period) => setFilters({ ...filters, period })}
          />
        }
      />
      {data !== undefined ? (
        <OverviewContent data={data} filters={filters} />
      ) : unreachable ? (
        <StatusLine>{UNREACHABLE_MESSAGE}</StatusLine>
      ) : (
        <StatusLine>Loading…</StatusLine>
      )}
    </div>
  );
}
