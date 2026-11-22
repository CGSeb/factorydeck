import type { ReactElement } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import {
  type FeatureDetail,
  type FeatureResponse,
  issueNumber,
} from '../features/types.ts';
import { DEFAULT_PERIOD, type Period, isPeriod } from '../overview/types.ts';
import { FeatureSessionTable } from './FeatureSessionTable.tsx';
import { type LoadFeature, featuresPath } from './features-api.ts';
import { formatClock } from './format.ts';
import { IssuePanel } from './IssuePanel.tsx';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import { PeriodSelector } from './PeriodSelector.tsx';
import { RoleTable } from './RoleTable.tsx';
import { useRefreshing } from './skills-api.ts';

export interface FeaturePageProps {
  loadFeature: LoadFeature;
}

function NotFound(): ReactElement {
  return (
    <>
      <p className="status">Issue not found.</p>
      <Link className="back-link" to="/features">
        Back to features
      </Link>
    </>
  );
}

function headingOf({ number, issue }: FeatureDetail): string {
  const label = `Issue #${String(number)}`;
  return issue.status === 'not-found' ? `${label} (not found)` : label;
}

function FeatureContent({
  feature,
  updatedAt,
  period,
  onPeriod,
}: {
  feature: FeatureDetail;
  updatedAt: string | null;
  period: Period;
  onPeriod: (period: Period) => void;
}): ReactElement {
  const roles =
    feature.orchestration === null
      ? feature.roles
      : [...feature.roles, feature.orchestration];
  return (
    <>
      <Link
        className="back-link"
        to={featuresPath({ period, project: feature.project })}
      >
        Back to features
      </Link>
      <div className="overview-header">
        <h1>{headingOf(feature)}</h1>
        {updatedAt !== null && (
          <p className="updated">Updated {formatClock(new Date(updatedAt))}</p>
        )}
        <PeriodSelector value={period} onChange={onPeriod} />
      </div>
      <p className="source">{feature.project}</p>
      {feature.detail !== null && <IssuePanel issue={feature.detail} />}
      {roles.length === 0 ? (
        <p className="status">No activity in this period.</p>
      ) : (
        <RoleTable roles={roles} />
      )}
      <FeatureSessionTable sessions={feature.sessions} now={new Date()} />
    </>
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
  if (response === undefined) return <p className="status">Loading…</p>;
  if (response.status === 'unreachable') {
    return <p className="status">{UNREACHABLE_MESSAGE}</p>;
  }
  if (response.status === 'not-found') return <NotFound />;
  return (
    <FeatureContent
      feature={response.feature}
      updatedAt={response.updatedAt}
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
  return (
    <div className="sessions">
      {number === undefined || project === '' ? (
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
      )}
    </div>
  );
}
