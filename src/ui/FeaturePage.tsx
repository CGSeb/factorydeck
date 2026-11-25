import type { ReactElement } from 'react';
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
import { DEFAULT_PERIOD, type Period, isPeriod } from '../overview/types.ts';
import { PageHeader } from './components/PageHeader.tsx';
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
import { IssueAside, IssueTitle, TimelinePanel } from './IssueParts.tsx';
import { issueActivity, issueColors, issueSteps } from './issue-page.ts';
import { renderRouterLink } from './Layout.tsx';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import { useProject, withProject } from './project-param.ts';
import { useRefreshing } from './skills-api.ts';
import { useNow } from './use-now.ts';
import { VersionBar } from './VersionBar.tsx';
import {
  NO_STEP,
  type VersionStep,
  dropsVersion,
  requestedVersion,
  steppedParams,
  versionView,
  withoutVersion,
} from './version-param.ts';
import './feature-page.css';

export interface FeaturePageProps {
  loadFeature: LoadFeature;
  kind?: IssueKind;
  now?: Date | undefined;
}

interface PageContext {
  kind: IssueKind;
  period: Period;
  onPeriod: (period: Period) => void;
  step: VersionStep;
  now: Date;
}

const LISTS: Record<
  IssueKind,
  { label: string; back: string; path: typeof featuresPath }
> = {
  feature: { label: 'Features', back: 'features', path: featuresPath },
  bug: { label: 'Bugs', back: 'bugs', path: bugsPath },
};

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

function FeatureContent({
  feature,
  page,
}: {
  feature: FeatureDetail;
  page: PageContext;
}): ReactElement {
  const { kind, period, step } = page;
  const colors = issueColors(feature);
  const stage = feature.detail?.outcome.stage;
  const { bar, busy } = versionView(feature, kind, step);
  return (
    <SplitPage
      aside={
        <IssueAside
          feature={feature}
          colors={colors}
          period={period}
          bug={kind === 'bug' ? { now: page.now } : null}
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
          slot={<PeriodPills value={period} onChange={page.onPeriod} />}
          renderLink={renderRouterLink}
        />
        {bar === null ? null : (
          <VersionBar
            shown={bar.shown}
            count={bar.count}
            onChange={(next) => {
              step.onChange(next, bar.count);
            }}
          />
        )}
        <div className="fd-issue-content" aria-busy={busy}>
          <TimelinePanel
            feature={feature}
            kind={kind}
            steps={issueSteps(feature, colors)}
          />
        </div>
      </div>
    </SplitPage>
  );
}

function Loaded({
  response,
  page,
}: {
  response: FeatureResponse | undefined;
  page: PageContext;
}): ReactElement {
  const { pathname, search } = useLocation();
  const { kind } = page;
  if (response === undefined) return <StatusLine>Loading…</StatusLine>;
  if (dropsVersion(response, { step: page.step, kind, search })) {
    return <Navigate replace to={withoutVersion(pathname, search)} />;
  }
  if (response.status === 'unreachable') {
    return <StatusLine>{UNREACHABLE_MESSAGE}</StatusLine>;
  }
  if (response.status === 'invalid-version') {
    return <StatusLine>Loading…</StatusLine>;
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
  return <FeatureContent feature={feature} page={page} />;
}

function FeatureLoader({
  loadFeature,
  project,
  number,
  page,
}: {
  loadFeature: LoadFeature;
  project: string;
  number: number;
  page: PageContext;
}): ReactElement {
  const { period } = page;
  const { requested } = page.step;
  const response = useRefreshing(
    JSON.stringify({ project, number, period, version: requested ?? null }),
    () => loadFeature({ project, number }, { period, project }, requested),
    JSON.stringify({ project, number }),
  );
  return <Loaded response={response} page={page} />;
}

export function FeaturePage({
  loadFeature,
  kind = 'feature',
  now: fixedNow,
}: FeaturePageProps): ReactElement {
  const params = useParams();
  const { pathname, search } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const now = useNow(fixedNow);
  const number = issueNumber(params['number'] ?? '');
  const project = searchParams.get('project') ?? '';
  const value = searchParams.get('period');
  const period = isPeriod(value) ? value : DEFAULT_PERIOD;
  const { requested, invalid } = requestedVersion(kind, searchParams);
  if (invalid) {
    return <Navigate replace to={withoutVersion(pathname, search)} />;
  }
  const step: VersionStep =
    kind === 'bug'
      ? {
          requested,
          onChange: (next, count) => {
            setSearchParams(steppedParams(searchParams, next, count), {
              replace: true,
            });
          },
        }
      : NO_STEP;
  const onPeriod = (next: Period): void => {
    const found = new URLSearchParams({ project, period: next });
    if (requested !== undefined) found.set('version', String(requested));
    setSearchParams(found);
  };
  return number === undefined || project === '' ? (
    <NotFound kind={kind} />
  ) : (
    <FeatureLoader
      loadFeature={loadFeature}
      project={project}
      number={number}
      page={{ kind, period, onPeriod, step, now }}
    />
  );
}
