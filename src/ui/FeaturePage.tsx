import type { ReactElement } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import {
  type FeatureDetail,
  type FeatureResponse,
  issueNumber,
} from '../features/types.ts';
import type { IssueStage } from '../git-host/types.ts';
import { DEFAULT_PERIOD, type Period, isPeriod } from '../overview/types.ts';
import { issueTitleText } from './components/IssueCard.tsx';
import { IssueSummary } from './components/IssueSummary.tsx';
import { IssueTimeline } from './components/IssueTimeline.tsx';
import { PageHeader } from './components/PageHeader.tsx';
import { Panel } from './components/Panel.tsx';
import { PeriodPills } from './components/PeriodPills.tsx';
import { SplitPage } from './components/SplitPage.tsx';
import { StageBadge } from './components/StageBadge.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { type LoadFeature, featuresPath } from './features-api.ts';
import {
  issueActivity,
  issueColors,
  issuePullRequest,
  issueSteps,
  issueTotal,
  roleSegments,
  summaryPullRequest,
} from './issue-page.ts';
import { renderRouterLink } from './Layout.tsx';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import { useProject, withProject } from './project-param.ts';
import { useRefreshing } from './skills-api.ts';
import './feature-page.css';

export interface FeaturePageProps {
  loadFeature: LoadFeature;
}

const MERGED_STAGES: readonly IssueStage[] = ['merged', 'merged-by-person'];

function NotFound(): ReactElement {
  const project = useProject();
  return (
    <div className="fd-issue-page">
      <Link className="fd-back" to={withProject('/features', project)}>
        ← Features
      </Link>
      <StatusLine>Issue not found.</StatusLine>
    </div>
  );
}

function IssueTitle({ feature }: { feature: FeatureDetail }): ReactElement {
  const title = issueTitleText(feature.issue);
  return (
    <>
      <span className="fd-issue-number">#{feature.number}</span>
      {title === null ? null : (
        <>
          {' '}
          {feature.issue.status === 'found' ? (
            <a href={feature.issue.url} target="_blank" rel="noreferrer">
              {title}
            </a>
          ) : (
            title
          )}
        </>
      )}
    </>
  );
}

function IssueAside({
  feature,
  colors,
}: {
  feature: FeatureDetail;
  colors: Map<string, string>;
}): ReactElement {
  const { detail, orchestration } = feature;
  const report = detail?.outcome.report ?? null;
  const request = issuePullRequest(detail);
  return (
    <IssueSummary
      total={issueTotal(feature)}
      orchestration={
        orchestration === null
          ? null
          : {
              counts: orchestration.tokenCounts,
              costUsd: orchestration.costUsd,
            }
      }
      roles={roleSegments(feature, colors)}
      serenity={
        report === null
          ? null
          : { score: report.score, threshold: report.threshold }
      }
      rounds={report?.rounds ?? null}
      pullRequest={summaryPullRequest(request)}
      checks={request?.checks ?? null}
      labels={detail === null ? null : detail.labels.map(({ name }) => name)}
      reworked={detail?.outcome.reworked ?? null}
    />
  );
}

function FeatureContent({
  feature,
  period,
  onPeriod,
}: {
  feature: FeatureDetail;
  period: Period;
  onPeriod: (period: Period) => void;
}): ReactElement {
  const colors = issueColors(feature);
  const steps = issueSteps(feature, colors);
  const stage = feature.detail?.outcome.stage;
  const merged = stage !== undefined && MERGED_STAGES.includes(stage);
  return (
    <SplitPage aside={<IssueAside feature={feature} colors={colors} />}>
      <div className="fd-issue-page">
        <PageHeader
          back={{
            label: `${feature.projectName} features`,
            href: featuresPath({ period, project: feature.project }),
          }}
          title={<IssueTitle feature={feature} />}
          summary={
            <span className="fd-issue-meta">
              {stage === undefined ? null : <StageBadge stage={stage} />}
              <span>{issueActivity(feature)}</span>
            </span>
          }
          slot={<PeriodPills value={period} onChange={onPeriod} />}
          renderLink={renderRouterLink}
        />
        <Panel heading={merged ? 'How it got merged' : 'Where it stands'}>
          {steps.length === 0 ? (
            <StatusLine>No activity in this period.</StatusLine>
          ) : (
            <IssueTimeline steps={steps} renderLink={renderRouterLink} />
          )}
        </Panel>
      </div>
    </SplitPage>
  );
}

function Loaded({
  response,
  period,
  onPeriod,
}: {
  response: FeatureResponse | undefined;
  period: Period;
  onPeriod: (period: Period) => void;
}): ReactElement {
  if (response === undefined) return <StatusLine>Loading…</StatusLine>;
  if (response.status === 'unreachable') {
    return <StatusLine>{UNREACHABLE_MESSAGE}</StatusLine>;
  }
  if (response.status === 'not-found') return <NotFound />;
  return (
    <FeatureContent
      feature={response.feature}
      period={period}
      onPeriod={onPeriod}
    />
  );
}

function FeatureLoader({
  loadFeature,
  project,
  number,
  period,
  onPeriod,
}: FeaturePageProps & {
  project: string;
  number: number;
  period: Period;
  onPeriod: (period: Period) => void;
}): ReactElement {
  const response = useRefreshing(
    JSON.stringify({ project, number, period }),
    () => loadFeature({ project, number }, { period, project }),
  );
  return <Loaded response={response} period={period} onPeriod={onPeriod} />;
}

export function FeaturePage({ loadFeature }: FeaturePageProps): ReactElement {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const number = issueNumber(params['number'] ?? '');
  const project = searchParams.get('project') ?? '';
  const value = searchParams.get('period');
  const period = isPeriod(value) ? value : DEFAULT_PERIOD;
  return number === undefined || project === '' ? (
    <NotFound />
  ) : (
    <FeatureLoader
      loadFeature={loadFeature}
      project={project}
      number={number}
      period={period}
      onPeriod={(next) =>
        setSearchParams(new URLSearchParams({ project, period: next }))
      }
    />
  );
}
