import type { ReactElement } from 'react';
import type { FrictionStats, FrictionsResponse } from '../frictions/types.ts';
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
  ALL_ROLES,
  API_CALL_NOUN,
  type KindChoice,
  chipText,
  frictionBuckets,
  frictionSummary,
  frictionTrendTitle,
  kindOptions,
  roleOptions,
} from './frictions-view.ts';
import { FrictionBreakdown } from './FrictionBreakdown.tsx';
import { FrictionFilterChip } from './FrictionFilterChip.tsx';
import { FrictionTables } from './FrictionTables.tsx';
import type { LoadOccurrences, LoadOutput } from './occurrences-api.ts';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import { useRefreshing } from './skills-api.ts';
import './frictions-page.css';

export interface FrictionsPageProps {
  loadFrictions: LoadFrictions;
  loadOccurrences: LoadOccurrences;
  loadOutput: LoadOutput;
  now?: Date | undefined;
}

export const NO_ACTIVITY = 'No activity in this period.';
export const NO_FRICTION = 'No friction in this period.';

function FrictionPills({
  stats,
  filters,
  onFilters,
}: {
  stats: FrictionStats;
  filters: FrictionFilters;
  onFilters: (next: FrictionFilters) => void;
}): ReactElement {
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
      <FilterPills<string>
        label="Role"
        options={roleOptions(stats.roleOptions)}
        value={filters.role ?? ALL_ROLES}
        onChange={(role) => {
          onFilters({
            ...filters,
            role: role === ALL_ROLES ? undefined : role,
          });
        }}
      />
    </>
  );
}

function FrictionsContent({
  stats,
  filters,
  now,
  loadOccurrences,
  loadOutput,
}: {
  stats: FrictionStats;
  filters: FrictionFilters;
  now: Date;
  loadOccurrences: LoadOccurrences;
  loadOutput: LoadOutput;
}): ReactElement {
  if (stats.apiCalls === 0) return <StatusLine>{NO_ACTIVITY}</StatusLine>;
  const scope = { project: filters.project, period: filters.period };
  const title = frictionTrendTitle(stats.unit);
  return (
    <>
      <Panel heading={title}>
        <TrendBars
          label={title}
          buckets={frictionBuckets(stats, now)}
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
          filters={filters}
          loadOccurrences={loadOccurrences}
          loadOutput={loadOutput}
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

function frictionControls({
  response,
  filters,
  onFilters,
}: {
  response: FrictionsResponse | undefined;
  filters: FrictionFilters;
  onFilters: (next: FrictionFilters) => void;
}): ReactElement | undefined {
  if (response?.status !== 'ok') return undefined;
  const stats = response.frictions;
  const chip = chipText(filters, stats.subject);
  const withFilters = stats.apiCalls > 0 || stats.role !== null;
  if (!withFilters && chip === null) return undefined;
  return (
    <>
      {withFilters && (
        <FrictionPills stats={stats} filters={filters} onFilters={onFilters} />
      )}
      {chip !== null && (
        <FrictionFilterChip
          text={chip}
          onRemove={() => {
            onFilters(withoutFilter(filters));
          }}
        />
      )}
    </>
  );
}

export function FrictionsPage({
  loadFrictions,
  loadOccurrences,
  loadOutput,
  now = new Date(),
}: FrictionsPageProps): ReactElement {
  const [filters, setFilters] = useFrictionFilters();
  const response = useRefreshing(
    JSON.stringify(filters),
    () => loadFrictions(filters),
    'frictions',
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
        controls={frictionControls({
          response,
          filters,
          onFilters: setFilters,
        })}
      />
      {response?.status === 'ok' ? (
        <FrictionsContent
          stats={response.frictions}
          filters={filters}
          now={now}
          loadOccurrences={loadOccurrences}
          loadOutput={loadOutput}
        />
      ) : (
        <StatusLine>
          {response === undefined ? 'Loading…' : UNREACHABLE_MESSAGE}
        </StatusLine>
      )}
    </div>
  );
}
