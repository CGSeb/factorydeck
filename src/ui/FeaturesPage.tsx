import type { ReactElement } from 'react';
import { useSearchParams } from 'react-router';
import type { FeatureList } from '../features/types.ts';
import type { IssueKind } from '../git-host/kind.ts';
import { DEFAULT_PERIOD, type Period, isPeriod } from '../overview/types.ts';
import { PageHeader } from './components/PageHeader.tsx';
import { PeriodPills } from './components/PeriodPills.tsx';
import { SortSelect } from './components/SortSelect.tsx';
import type { StageGroup } from './components/StageDot.tsx';
import { StageStrip } from './components/StageStrip.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { type LoadFeatures, loadKindList } from './features-api.ts';
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
import { kindOf, noKindText, shownKind, withKind } from './kind-filter.ts';
import { KindFilter } from './KindFilter.tsx';
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
  kind: IssueKind | null;
}

interface ListSetters {
  setSort: (sort: FeatureSortKey) => void;
  setStage: (stage: StageGroup | null) => void;
  setKind: (kind: IssueKind | null) => void;
}

function useListParams(): ListView &
  ListSetters & { setPeriod: (period: Period) => void } {
  const [params, setParams] = useSearchParams();
  const period = params.get('period');
  const view: ListView = {
    filters: {
      period: isPeriod(period) ? period : DEFAULT_PERIOD,
      project: projectOf(params),
    },
    sort: featureSortOf(params),
    stage: stageOf(params),
    kind: kindOf(params),
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
    setKind: (kind) =>
      setParams((current) => withKind(withListParams(current, view), kind)),
  };
}

function IssuesBody({
  list,
  view,
  kind,
}: {
  list: FeatureList;
  view: ListView;
  kind: IssueKind | null;
}): ReactElement {
  if (
    view.stage !== null &&
    list.rows.every((row) => groupOf(row) !== view.stage)
  ) {
    return <StatusLine>No issue in this stage.</StatusLine>;
  }
  if (kind !== null && list.rows.length === 0) {
    return <StatusLine>{noKindText(kind)}</StatusLine>;
  }
  return (
    <IssueGroupsTable
      list={list}
      filters={view.filters}
      sort={view.sort}
      stage={view.stage}
      kind={kind}
    />
  );
}

function FeaturesContent({
  list,
  view,
  setSort,
  setStage,
  setKind,
}: {
  list: FeatureList;
  view: ListView;
} & ListSetters): ReactElement {
  if (list.totals.apiCalls === 0) {
    return <StatusLine>No activity in this period.</StatusLine>;
  }
  const kind = shownKind(list, view.kind);
  return (
    <>
      <div className="fd-features-filters">
        {list.bugTickets && (
          <KindFilter kinds={list.kinds} value={kind} onChange={setKind} />
        )}
        <StageStrip
          stages={stageItems(list.rows)}
          value={view.stage}
          onChange={setStage}
        />
      </div>
      <div className="fd-features-issues">
        <div className="fd-features-issues-head">
          <h2 className="fd-features-issues-title">Issues</h2>
          <SortSelect
            options={FEATURE_SORT_OPTIONS}
            value={view.sort}
            onChange={setSort}
          />
        </div>
        <IssuesBody list={list} view={view} kind={kind} />
      </div>
    </>
  );
}

export function FeaturesPage({
  loadFeatures,
}: FeaturesPageProps): ReactElement {
  const { setPeriod, setSort, setStage, setKind, ...view } = useListParams();
  const response = useRefreshing(
    JSON.stringify({ ...view.filters, kind: view.kind }),
    () => loadKindList(loadFeatures, view.filters, view.kind),
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
          setKind={setKind}
        />
      )}
    </div>
  );
}
