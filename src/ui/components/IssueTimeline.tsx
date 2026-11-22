import type { ReactElement } from 'react';
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

export interface IssueTimelineProps {
  steps: TimelineStep[];
  renderLink?: RenderLink;
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
  renderLink = renderAnchor,
}: IssueTimelineProps): ReactElement {
  return (
    <ol className="fd-timeline">
      {steps.map((step) => (
        <li key={step.id} className="fd-timeline-step" data-role={step.role}>
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
      ))}
    </ol>
  );
}
