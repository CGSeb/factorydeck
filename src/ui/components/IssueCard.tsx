import type { ReactElement } from 'react';
import type { IssueStage } from '../../git-host/types.ts';
import { BugBadge } from './BugBadge.tsx';
import { pillStyle } from './label-styles.ts';
import { type RenderLink, renderAnchor } from './link.ts';
import { ProjectTag } from './ProjectTag.tsx';
import { RoundsBadge } from './RoundsBadge.tsx';
import { type SerenityScore, SerenityBadge } from './SerenityBadge.tsx';
import { StageBadge } from './StageBadge.tsx';
import './work.css';

export type IssueTitle =
  | { status: 'found'; title: string }
  | { status: 'not-found' }
  | { status: 'not-collected' };

export interface IssueCardIssue {
  project: string;
  projectName: string;
  projectColor: string;
  number: number;
  title: IssueTitle;
  href: string;
}

export type IssueCardBadge =
  | { kind: 'bug' }
  | { kind: 'stage'; stage: IssueStage }
  | { kind: 'serenity'; report: SerenityScore }
  | { kind: 'rounds'; rounds: number; inReview?: boolean }
  | { kind: 'text'; text: string };

export interface IssueCardActivity {
  at: string;
  text: string;
}

export interface IssueCardProps {
  issue: IssueCardIssue;
  badge?: IssueCardBadge | readonly IssueCardBadge[];
  activity?: IssueCardActivity | undefined;
  showProject: boolean;
  renderLink?: RenderLink;
}

export function issueTitleText(title: IssueTitle): string | null {
  if (title.status === 'found') return title.title;
  if (title.status === 'not-found') return '(not found)';
  return null;
}

function badgesOf(
  badge: IssueCardBadge | readonly IssueCardBadge[] | undefined,
): readonly IssueCardBadge[] {
  if (badge === undefined) return [];
  return 'kind' in badge ? [badge] : badge;
}

function Badge({ badge }: { badge: IssueCardBadge }): ReactElement | null {
  switch (badge.kind) {
    case 'bug':
      return <BugBadge />;
    case 'stage':
      return <StageBadge stage={badge.stage} />;
    case 'serenity':
      return <SerenityBadge report={badge.report} />;
    case 'rounds':
      return (
        <RoundsBadge rounds={badge.rounds} inReview={badge.inReview ?? false} />
      );
    case 'text':
      return (
        <span data-tone="neutral" style={pillStyle('neutral')}>
          {badge.text}
        </span>
      );
  }
}

export function IssueCard({
  issue,
  badge,
  activity,
  showProject,
  renderLink = renderAnchor,
}: IssueCardProps): ReactElement {
  const title = issueTitleText(issue.title);
  return (
    <article className="fd-issue-card">
      {showProject ? (
        <span>
          <ProjectTag
            project={issue.project}
            name={issue.projectName}
            color={issue.projectColor}
          />
        </span>
      ) : null}
      {renderLink({
        href: issue.href,
        className: 'fd-issue-card-title',
        children: (
          <>
            <span className="fd-issue-card-number">#{issue.number}</span>
            {title === null ? null : <> {title}</>}
          </>
        ),
      })}
      <div className="fd-issue-card-foot">
        <span className="fd-issue-card-badges">
          {badgesOf(badge).map((item, index) => (
            <Badge key={`${String(index)} ${item.kind}`} badge={item} />
          ))}
        </span>
        {activity === undefined ? null : (
          <time className="fd-issue-card-time" dateTime={activity.at}>
            {activity.text}
          </time>
        )}
      </div>
    </article>
  );
}
