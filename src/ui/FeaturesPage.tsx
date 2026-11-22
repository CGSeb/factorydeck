import type { ReactElement } from 'react';
import { useSearchParams } from 'react-router';
import type { FeatureList } from '../features/types.ts';
import { DEFAULT_PERIOD, type Period, isPeriod } from '../overview/types.ts';
import { PageHeader } from './components/PageHeader.tsx';
import { PeriodPills } from './components/PeriodPills.tsx';
import { SortSelect } from './components/SortSelect.tsx';
import type { StageGroup } from './components/StageDot.tsx';
import { StageStrip } from './components/StageStrip.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import type { LoadFeatures } from './features-api.ts';
import {
  FEATURE_SORT_OPTIONS,
  type FeatureSortKey,
  featureSortOf,
  groupOf,
  stageItems,
  stageOf,
  summaryText,
  withListParams,
} from './features-list.ts';
import { IssueGroupsTable } from './IssueGroupsTable.tsx';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import { projectOf } from './project-param.ts';
import { type SkillFilters, useRefreshing } from './skills-api.ts';
import './features-page.css';

export interface FeaturesPageProps {
  loadFeatures: LoadFeatures;
}

interface ListView {
  filters: SkillFilters;
  sort: FeatureSortKey;
  stage: StageGroup | null;
}

function useListParams(): ListView & {
  setPeriod: (period: Period) => void;
  setSort: (sort: FeatureSortKey) => void;
  setStage: (stage: StageGroup | null) => void;
} {
  const [params, setParams] = useSearchParams();
  const period = params.get('period');
  const view: ListView = {
    filters: {
      period: isPeriod(period) ? period : DEFAULT_PERIOD,
      project: projectOf(params),
    },
    sort: featureSortOf(params),
    stage: stageOf(params),
  };
  return {
    ...view,
    setPeriod: (next) =>
      setParams((current) => {
        const updated = withListParams(current, view);
        updated.set('period', next);
        return updated;
      }),
    setSort: (sort) =>
      setParams((current) => withListParams(current, { ...view, sort })),
    setStage: (stage) =>
      setParams((current) => withListParams(current, { ...view, stage })),
  };
}

function FeaturesContent({
  list,
  view,
  setSort,
  setStage,
}: {
  list: FeatureList;
  view: ListView;
  setSort: (sort: FeatureSortKey) => void;
  setStage: (stage: StageGroup | null) => void;
}): ReactElement {
  if (list.totals.apiCalls === 0) {
    return <StatusLine>No activity in this period.</StatusLine>;
  }
  return (
    <>
      <StageStrip
        stages={stageItems(list.rows)}
        value={view.stage}
        onChange={setStage}
      />
      <div className="fd-features-issues">
        <div className="fd-features-issues-head">
          <h2 className="fd-features-issues-title">Issues</h2>
          <SortSelect
            options={FEATURE_SORT_OPTIONS}
            value={view.sort}
            onChange={setSort}
          />
        </div>
        {view.stage !== null &&
        list.rows.every((row) => groupOf(row) !== view.stage) ? (
          <StatusLine>No issue in this stage.</StatusLine>
        ) : (
          <IssueGroupsTable
            list={list}
            filters={view.filters}
            sort={view.sort}
            stage={view.stage}
          />
        )}
      </div>
    </>
  );
}

export function FeaturesPage({
  loadFeatures,
}: FeaturesPageProps): ReactElement {
  const { setPeriod, setSort, setStage, ...view } = useListParams();
  const response = useRefreshing(
    JSON.stringify(view.filters),
    () => loadFeatures(view.filters),
    'features',
  );
  const list = response?.status === 'ok' ? response.list : undefined;
  return (
    <div className="fd-features">
      <PageHeader
        title="Features"
        summary={
          list === undefined
            ? undefined
            : summaryText(list.rows.length, list.merged)
        }
        pending={response === undefined}
        slot={<PeriodPills value={view.filters.period} onChange={setPeriod} />}
      />
      {response === undefined ? (
        <StatusLine>Loading…</StatusLine>
      ) : list === undefined ? (
        <StatusLine>{UNREACHABLE_MESSAGE}</StatusLine>
      ) : (
        <FeaturesContent
          list={list}
          view={view}
          setSort={setSort}
          setStage={setStage}
        />
      )}
    </div>
  );
}
