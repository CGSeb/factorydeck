import type { ReactElement } from 'react';
import type { FrictionsResponse } from '../frictions/types.ts';
import type { Period } from '../overview/types.ts';
import { FilterPills } from './components/FilterPills.tsx';
import { PageHeader } from './components/PageHeader.tsx';
import { Panel } from './components/Panel.tsx';
import { PeriodPills } from './components/PeriodPills.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { TrendBars } from './components/TrendBars.tsx';
import {
  type FrictionFilters,
  type LoadFrictions,
  useFrictionFilters,
  withoutFilter,
} from './frictions-api.ts';
import {
  ALL_KINDS,
  API_CALL_NOUN,
  type KindChoice,
  chipText,
  frictionSummary,
  kindOptions,
  weekBuckets,
} from './frictions-view.ts';
import { FrictionBreakdown } from './FrictionBreakdown.tsx';
import { FrictionFilterChip } from './FrictionFilterChip.tsx';
import { FrictionTables } from './FrictionTables.tsx';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import { useRefreshing } from './skills-api.ts';
import './frictions-page.css';

export interface FrictionsPageProps {
  loadFrictions: LoadFrictions;
}

export const TREND_TITLE = 'Frictions per 100 API calls, by week';
export const NO_ACTIVITY = 'No activity in this period.';
export const NO_FRICTION = 'No friction in this period.';

function FrictionsContent({
  response,
  filters,
  onFilters,
}: {
  response: FrictionsResponse | undefined;
  filters: FrictionFilters;
  onFilters: (next: FrictionFilters) => void;
}): ReactElement {
  if (response === undefined) return <StatusLine>Loading…</StatusLine>;
  if (response.status === 'unreachable') {
    return <StatusLine>{UNREACHABLE_MESSAGE}</StatusLine>;
  }
  const { frictions: stats } = response;
  if (stats.apiCalls === 0) return <StatusLine>{NO_ACTIVITY}</StatusLine>;
  const scope = { project: filters.project, period: filters.period };
  return (
    <>
      <FilterPills<KindChoice>
        label="Kind"
        options={kindOptions(stats.counts)}
        value={filters.kind ?? ALL_KINDS}
        onChange={(kind) => {
          onFilters({
            ...filters,
            kind: kind === ALL_KINDS ? undefined : kind,
          });
        }}
      />
      <Panel heading={TREND_TITLE}>
        <TrendBars
          label={TREND_TITLE}
          buckets={weekBuckets(stats.weeks)}
          scale="count"
          color="var(--fd-warning)"
          height={64}
          noun={API_CALL_NOUN}
        />
      </Panel>
      {stats.frictions === 0 ? (
        <StatusLine>{NO_FRICTION}</StatusLine>
      ) : (
        <FrictionTables
          stats={stats}
          kind={stats.kind ?? undefined}
          scope={scope}
        />
      )}
      <FrictionBreakdown
        stats={stats}
        kind={stats.kind ?? undefined}
        scope={scope}
        period={filters.period}
        withTables={stats.frictions > 0}
      />
    </>
  );
}

export function FrictionsPage({
  loadFrictions,
}: FrictionsPageProps): ReactElement {
  const [filters, setFilters] = useFrictionFilters();
  const response = useRefreshing(
    JSON.stringify(filters),
    () => loadFrictions(filters),
    'frictions',
  );
  const chip = chipText(
    filters,
    response?.status === 'ok' ? response.frictions.subject : undefined,
  );
  return (
    <div className="fd-frictions">
      <PageHeader
        title="Frictions"
        {...(response?.status === 'ok'
          ? { summary: frictionSummary(response.frictions) }
          : {})}
        pending={response === undefined}
        slot={
          <PeriodPills
            value={filters.period}
            onChange={(period: Period) => {
              setFilters({ ...filters, period });
            }}
          />
        }
      />
      {chip === null ? null : (
        <FrictionFilterChip
          text={chip}
          onRemove={() => {
            setFilters(withoutFilter(filters));
          }}
        />
      )}
      <FrictionsContent
        response={response}
        filters={filters}
        onFilters={setFilters}
      />
    </div>
  );
}
