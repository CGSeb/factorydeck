import type { ReactElement, ReactNode } from 'react';
import type { FeatureDetail } from '../features/types.ts';
import type { IssueKind } from '../git-host/kind.ts';
import type { IssueStage } from '../git-host/types.ts';
import type { Period } from '../overview/types.ts';
import { issueTitleText } from './components/IssueCard.tsx';
import { IssueSummary } from './components/IssueSummary.tsx';
import {
  IssueTimeline,
  type TimelineStep,
} from './components/IssueTimeline.tsx';
import { Panel } from './components/Panel.tsx';
import { serenityScore } from './components/SerenityBadge.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { FixBlock } from './FixBlock.tsx';
import { frictionsHref } from './frictions-api.ts';
import {
  issueMilestones,
  issuePullRequest,
  issueTotal,
  roleSegments,
  summaryPullRequest,
} from './issue-page.ts';
import { renderRouterLink } from './Layout.tsx';
import { VersionBlock } from './VersionBlock.tsx';
import './feature-page.css';

export const NO_ACTIVITY: Record<IssueKind, string> = {
  feature: 'No activity in this period.',
  bug: 'No activity in this version.',
};

const MERGED_STAGES: readonly IssueStage[] = [
  'merged',
  'merged-by-person',
  'merged-after-person',
];

export function IssueTitle({
  feature,
}: {
  feature: FeatureDetail;
}): ReactElement {
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

function bugLead(feature: FeatureDetail, bug: { now: Date } | null): ReactNode {
  if (bug === null) return null;
  return (
    <>
      <FixBlock fix={feature.fix} />
      <VersionBlock version={feature.version} now={bug.now} />
    </>
  );
}

export function IssueAside({
  feature,
  colors,
  period,
  bug,
}: {
  feature: FeatureDetail;
  colors: Map<string, string>;
  period: Period;
  bug: { now: Date } | null;
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
      lead={bugLead(feature, bug)}
      renderLink={renderRouterLink}
    />
  );
}

export function TimelinePanel({
  feature,
  kind,
  steps,
}: {
  feature: FeatureDetail;
  kind: IssueKind;
  steps: TimelineStep[];
}): ReactElement {
  const stage = feature.detail?.outcome.stage;
  const merged = stage !== undefined && MERGED_STAGES.includes(stage);
  const milestones = issueMilestones(feature);
  const empty =
    steps.length === 0 && (kind === 'feature' || milestones.length === 0);
  return (
    <Panel heading={merged ? 'How it got merged' : 'Where it stands'}>
      {empty ? (
        <StatusLine>{NO_ACTIVITY[kind]}</StatusLine>
      ) : (
        <IssueTimeline
          steps={steps}
          milestones={milestones}
          renderLink={renderRouterLink}
        />
      )}
    </Panel>
  );
}
