import type { ReactElement } from 'react';
import type { FeatureListResponse } from '../features/types.ts';
import type { Period } from '../overview/types.ts';
import { FeatureTable } from './FeatureTable.tsx';
import { FeatureTiles } from './FeatureTiles.tsx';
import {
  type FeatureSort,
  type LoadFeatures,
  useFeatureParams,
} from './features-api.ts';
import { formatClock } from './format.ts';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import { PeriodSelector } from './PeriodSelector.tsx';
import { ProjectSelect } from './ProjectSelect.tsx';
import { type SkillFilters, useRefreshing } from './skills-api.ts';

export interface FeaturesPageProps {
  loadFeatures: LoadFeatures;
}

function FeaturesContent({
  response,
  filters,
  sort,
  onSort,
}: {
  response: FeatureListResponse | undefined;
  filters: SkillFilters;
  sort: FeatureSort;
  onSort: (sort: FeatureSort) => void;
}): ReactElement {
  if (response === undefined) return <p className="status">Loading…</p>;
  if (response.status === 'unreachable') {
    return <p className="status">{UNREACHABLE_MESSAGE}</p>;
  }
  const { list } = response;
  if (list.totals.apiCalls === 0) {
    return <p className="status">No activity in this period.</p>;
  }
  return (
    <>
      <FeatureTiles totals={list.totals} merged={list.merged} />
      <FeatureTable
        rows={list.rows}
        noWorkItem={list.noWorkItem}
        totals={list.totals}
        filters={filters}
        sort={sort}
        onSort={onSort}
      />
    </>
  );
}

export function FeaturesPage({
  loadFeatures,
}: FeaturesPageProps): ReactElement {
  const { filters, sort, setFilters, setSort } = useFeatureParams();
  const response = useRefreshing(JSON.stringify(filters), () =>
    loadFeatures(filters),
  );
  const updatedAt =
    response?.status === 'ok' && response.updatedAt !== null
      ? formatClock(new Date(response.updatedAt))
      : undefined;

  return (
    <div className="sessions">
      <div className="overview-header">
        <h1>Features</h1>
        {updatedAt !== undefined && (
          <p className="updated">Updated {updatedAt}</p>
        )}
        <PeriodSelector
          value={filters.period}
          onChange={(period: Period) => setFilters({ ...filters, period })}
        />
      </div>
      <div className="filters">
        <ProjectSelect
          value={filters.project}
          projects={response?.status === 'ok' ? response.list.projects : []}
          onChange={(project) => setFilters({ ...filters, project })}
        />
      </div>
      <FeaturesContent
        response={response}
        filters={filters}
        sort={sort}
        onSort={setSort}
      />
    </div>
  );
}
