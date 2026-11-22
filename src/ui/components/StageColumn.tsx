import { type ReactElement, useId } from 'react';
import { IssueCard, type IssueCardProps } from './IssueCard.tsx';
import { type RenderLink, renderAnchor } from './link.ts';
import { type StageGroup, StageDot } from './StageDot.tsx';
import { STAGE_GROUP_LABELS } from './StageStrip.tsx';
import { TokenAmount } from './TokenAmount.tsx';
import type { TokenCounts } from './token-amount.ts';
import './work.css';

export interface StageColumnMore {
  count: number;
  href: string;
}

export type StageColumnCard = Omit<IssueCardProps, 'renderLink'>;

export interface StageColumnProps {
  group: StageGroup;
  count: number;
  counts: TokenCounts;
  costUsd: number | null;
  unknownPriceCalls?: number;
  cards: StageColumnCard[];
  more: StageColumnMore;
  renderLink?: RenderLink;
}

export function StageColumn({
  group,
  count,
  counts,
  costUsd,
  unknownPriceCalls = 0,
  cards,
  more,
  renderLink = renderAnchor,
}: StageColumnProps): ReactElement {
  const headingId = useId();
  return (
    <section
      className="fd-stage-column"
      data-group={group}
      aria-labelledby={headingId}
    >
      <div className="fd-stage-column-head">
        <h2 id={headingId} className="fd-stage-column-heading">
          <StageDot group={group} />
          {STAGE_GROUP_LABELS[group]}
          <span className="fd-stage-column-count">{count}</span>
        </h2>
        <span className="fd-stage-column-tokens">
          <TokenAmount
            counts={counts}
            costUsd={costUsd}
            unknownPriceCalls={unknownPriceCalls}
            placement="below"
          />{' '}
          tokens
        </span>
      </div>
      {cards.length === 0 ? (
        <p className="fd-stage-column-empty">No issue</p>
      ) : (
        <ul className="fd-stage-column-cards">
          {cards.map((card) => (
            <li key={`${card.issue.project} ${String(card.issue.number)}`}>
              <IssueCard {...card} renderLink={renderLink} />
            </li>
          ))}
        </ul>
      )}
      {more.count > 0
        ? renderLink({
            href: more.href,
            className: 'fd-stage-column-more',
            children: `+ ${String(more.count)} more`,
          })
        : null}
    </section>
  );
}
