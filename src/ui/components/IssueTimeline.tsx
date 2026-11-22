import { Fragment, type ReactElement } from 'react';
import { type RenderLink, renderAnchor } from './link.ts';
import { TokenAmount } from './TokenAmount.tsx';
import type { TokenCounts } from './token-amount.ts';
import './work.css';

export interface TimelineThread {
  id: string;
  title: string;
  href: string;
  date: string;
  counts: TokenCounts;
  costUsd: number | null;
  unknownPriceCalls?: number;
}

export interface TimelineStep {
  id: string;
  role: string;
  color: string;
  title: string;
  detail: string;
  counts: TokenCounts;
  costUsd: number | null;
  unknownPriceCalls?: number;
  threads: TimelineThread[];
}

export interface TimelineMilestone {
  id: string;
  afterStep: string | null;
  tone: 'success' | 'warning';
  title: string;
  detail: string;
  link?: { href: string; text: string };
}

export interface IssueTimelineProps {
  steps: TimelineStep[];
  milestones?: TimelineMilestone[];
  renderLink?: RenderLink;
}

function Milestone({
  milestone,
}: {
  milestone: TimelineMilestone;
}): ReactElement {
  return (
    <li className="fd-timeline-milestone" data-tone={milestone.tone}>
      <span aria-hidden="true" className="fd-timeline-milestone-marker" />
      <span className="fd-timeline-milestone-title">{milestone.title}</span>
      <p className="fd-timeline-detail">
        {milestone.detail}
        {milestone.link === undefined ? null : (
          <>
            {' · '}
            <a href={milestone.link.href} target="_blank" rel="noreferrer">
              {milestone.link.text}
            </a>
          </>
        )}
      </p>
    </li>
  );
}

function milestonesAfter(
  milestones: TimelineMilestone[],
  step: string | null,
): ReactElement[] {
  return milestones
    .filter((milestone) => milestone.afterStep === step)
    .map((milestone) => <Milestone key={milestone.id} milestone={milestone} />);
}

function Thread({
  thread,
  renderLink,
}: {
  thread: TimelineThread;
  renderLink: RenderLink;
}): ReactElement {
  return (
    <li className="fd-timeline-thread">
      {renderLink({
        href: thread.href,
        className: 'fd-thread-link',
        children: thread.title,
      })}
      <span className="fd-thread-date">{thread.date}</span>
      <TokenAmount
        counts={thread.counts}
        costUsd={thread.costUsd}
        unknownPriceCalls={thread.unknownPriceCalls ?? 0}
      />
    </li>
  );
}

export function IssueTimeline({
  steps,
  milestones = [],
  renderLink = renderAnchor,
}: IssueTimelineProps): ReactElement {
  return (
    <ol className="fd-timeline">
      {milestonesAfter(milestones, null)}
      {steps.map((step) => (
        <Fragment key={step.id}>
          <li className="fd-timeline-step" data-role={step.role}>
            <span
              aria-hidden="true"
              className="fd-timeline-marker"
              style={{ borderColor: step.color }}
            />
            <div className="fd-timeline-head">
              <span className="fd-timeline-title">{step.title}</span>
              <TokenAmount
                counts={step.counts}
                costUsd={step.costUsd}
                unknownPriceCalls={step.unknownPriceCalls ?? 0}
                size="strong"
              />
            </div>
            <p className="fd-timeline-detail">{step.detail}</p>
            {step.threads.length > 0 ? (
              <ul className="fd-timeline-threads">
                {step.threads.map((thread) => (
                  <Thread
                    key={thread.id}
                    thread={thread}
                    renderLink={renderLink}
                  />
                ))}
              </ul>
            ) : null}
          </li>
          {milestonesAfter(milestones, step.id)}
        </Fragment>
      ))}
    </ol>
  );
}
