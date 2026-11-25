import type { ReactElement, ReactNode } from 'react';
import {
  Link,
  Navigate,
  useLocation,
  useParams,
  useSearchParams,
} from 'react-router';
import {
  type FeatureDetail,
  type FeatureResponse,
  issueNumber,
} from '../features/types.ts';
import type { IssueKind } from '../git-host/kind.ts';
import type { IssueStage } from '../git-host/types.ts';
import { DEFAULT_PERIOD, type Period, isPeriod } from '../overview/types.ts';
import { issueTitleText } from './components/IssueCard.tsx';
import { IssueSummary } from './components/IssueSummary.tsx';
import { IssueTimeline } from './components/IssueTimeline.tsx';
import { serenityScore } from './components/SerenityBadge.tsx';
import { PageHeader } from './components/PageHeader.tsx';
import { Panel } from './components/Panel.tsx';
import { PeriodPills } from './components/PeriodPills.tsx';
import { SplitPage } from './components/SplitPage.tsx';
import { StageBadge } from './components/StageBadge.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import {
  type LoadFeature,
  bugsPath,
  featuresPath,
  issuePageBase,
} from './features-api.ts';
import { FixBlock } from './FixBlock.tsx';
import { frictionsHref } from './frictions-api.ts';
import {
  issueActivity,
  issueColors,
  issueMilestones,
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
  kind?: IssueKind;
}

const LISTS: Record<
  IssueKind,
  { label: string; back: string; path: typeof featuresPath }
> = {
  feature: { label: 'Features', back: 'features', path: featuresPath },
  bug: { label: 'Bugs', back: 'bugs', path: bugsPath },
};

const MERGED_STAGES: readonly IssueStage[] = [
  'merged',
  'merged-by-person',
  'merged-after-person',
];

function NotFound({ kind }: { kind: IssueKind }): ReactElement {
  const project = useProject();
  return (
    <div className="fd-issue-page">
      <Link className="fd-back" to={withProject(issuePageBase(kind), project)}>
        ← {LISTS[kind].label}
      </Link>
      <StatusLine>Issue not found.</StatusLine>
    </div>
  );
}

function IssueTitle({ feature }: { feature: FeatureDetail }): ReactElement {
  if (feature.issue.status === 'found') {
    return (
      <>
        <a
          className="fd-issue-link"
          href={feature.issue.url}
          target="_blank"
          rel="noreferrer"
        >
          {feature.issue.title}
          <span className="fd-issue-link-icon" aria-hidden="true">
            ↗
          </span>
        </a>{' '}
        <span className="fd-issue-number">(#{feature.number})</span>
      </>
    );
  }
  const title = issueTitleText(feature.issue);
  return (
    <>
      <span className="fd-issue-number">#{feature.number}</span>
      {title === null ? null : ` ${title}`}
    </>
  );
}

function IssueAside({
  feature,
  colors,
  period,
  lead,
}: {
  feature: FeatureDetail;
  colors: Map<string, string>;
  period: Period;
  lead: ReactNode;
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
      serenity={report === null ? null : serenityScore(report)}
      rounds={report?.rounds ?? null}
      pullRequest={summaryPullRequest(request)}
      checks={request?.checks ?? null}
      labels={detail === null ? null : detail.labels.map(({ name }) => name)}
      reworked={detail?.outcome.reworked ?? null}
      frictions={{
        count: feature.frictions,
        href: frictionsHref({
          period,
          project: feature.project,
          issue: feature.number,
        }),
      }}
      lead={lead}
      renderLink={renderRouterLink}
    />
  );
}

function FeatureContent({
  feature,
  kind,
  period,
  onPeriod,
}: {
  feature: FeatureDetail;
  kind: IssueKind;
  period: Period;
  onPeriod: (period: Period) => void;
}): ReactElement {
  const colors = issueColors(feature);
  const steps = issueSteps(feature, colors);
  const stage = feature.detail?.outcome.stage;
  const merged = stage !== undefined && MERGED_STAGES.includes(stage);
  return (
    <SplitPage
      aside={
        <IssueAside
          feature={feature}
          colors={colors}
          period={period}
          lead={kind === 'bug' ? <FixBlock fix={feature.fix} /> : null}
        />
      }
    >
      <div className="fd-issue-page">
        <PageHeader
          back={{
            label: `${feature.projectName} ${LISTS[kind].back}`,
            href: LISTS[kind].path({ period, project: feature.project }),
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
            <IssueTimeline
              steps={steps}
              milestones={issueMilestones(feature)}
              renderLink={renderRouterLink}
            />
          )}
        </Panel>
      </div>
    </SplitPage>
  );
}

function Loaded({
  response,
  kind,
  period,
  onPeriod,
}: {
  response: FeatureResponse | undefined;
  kind: IssueKind;
  period: Period;
  onPeriod: (period: Period) => void;
}): ReactElement {
  const { search } = useLocation();
  if (response === undefined) return <StatusLine>Loading…</StatusLine>;
  if (response.status === 'unreachable') {
    return <StatusLine>{UNREACHABLE_MESSAGE}</StatusLine>;
  }
  if (response.status === 'not-found') return <NotFound kind={kind} />;
  const { feature } = response;
  if (feature.kind !== null && feature.kind !== kind) {
    return (
      <Navigate
        replace
        to={`${issuePageBase(feature.kind)}/${String(feature.number)}${search}`}
      />
    );
  }
  if (feature.kind === null && kind === 'bug') return <NotFound kind={kind} />;
  return (
    <FeatureContent
      feature={feature}
      kind={kind}
      period={period}
      onPeriod={onPeriod}
    />
  );
}

function FeatureLoader({
  loadFeature,
  kind,
  project,
  number,
  period,
  onPeriod,
}: {
  loadFeature: LoadFeature;
  kind: IssueKind;
  project: string;
  number: number;
  period: Period;
  onPeriod: (period: Period) => void;
}): ReactElement {
  const response = useRefreshing(
    JSON.stringify({ project, number, period }),
    () => loadFeature({ project, number }, { period, project }),
    JSON.stringify({ project, number }),
  );
  return (
    <Loaded
      response={response}
      kind={kind}
      period={period}
      onPeriod={onPeriod}
    />
  );
}

export function FeaturePage({
  loadFeature,
  kind = 'feature',
}: FeaturePageProps): ReactElement {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const number = issueNumber(params['number'] ?? '');
  const project = searchParams.get('project') ?? '';
  const value = searchParams.get('period');
  const period = isPeriod(value) ? value : DEFAULT_PERIOD;
  return number === undefined || project === '' ? (
    <NotFound kind={kind} />
  ) : (
    <FeatureLoader
      loadFeature={loadFeature}
      kind={kind}
      project={project}
      number={number}
      period={period}
      onPeriod={(next) =>
        setSearchParams(new URLSearchParams({ project, period: next }))
      }
    />
  );
}
