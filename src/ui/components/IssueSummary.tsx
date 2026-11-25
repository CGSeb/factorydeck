import { Fragment, type ReactElement, type ReactNode } from 'react';
import type { ChecksSummary, RequestState } from '../../git-host/types.ts';
import { MISSING, formatCount } from '../format.ts';
import { Aside } from './Aside.tsx';
import { type ChartSegment, wholePercent } from './chart-math.ts';
import { type RenderLink, renderAnchor } from './link.ts';
import { CHECKS_TEXT, requestStateText } from './request-text.ts';
import type { SerenityScore } from './SerenityBadge.tsx';
import { SplitBar } from './SplitBar.tsx';
import { SplitLegend } from './SplitLegend.tsx';
import {
  TokenAmount,
  type TokenAmountPlacement,
  type TokenAmountSize,
} from './TokenAmount.tsx';
import { type TokenCounts, totalTokens } from './token-amount.ts';
import './work.css';

export interface SummaryAmount {
  counts: TokenCounts;
  costUsd: number | null;
  unknownPriceCalls?: number;
}

export interface SummaryPullRequest {
  number: number;
  url: string;
  state: RequestState;
  draft: boolean;
}

export interface SummaryFrictions {
  count: number;
  href: string;
}

export const NO_FRICTION = 'None';

export interface IssueSummaryProps {
  total: SummaryAmount;
  orchestration: SummaryAmount | null;
  roles: ChartSegment[];
  serenity: SerenityScore | null;
  rounds: number | null;
  pullRequest: SummaryPullRequest | null;
  checks: ChecksSummary | null;
  labels: string[] | null;
  reworked: boolean | null;
  frictions?: SummaryFrictions | undefined;
  lead?: ReactNode;
  renderLink?: RenderLink;
}

function Amount({
  amount,
  size = 'inline',
  placement = 'above',
}: {
  amount: SummaryAmount;
  size?: TokenAmountSize;
  placement?: TokenAmountPlacement;
}): ReactElement {
  return (
    <TokenAmount
      counts={amount.counts}
      costUsd={amount.costUsd}
      unknownPriceCalls={amount.unknownPriceCalls ?? 0}
      size={size}
      placement={placement}
    />
  );
}

function SerenityFigure({
  serenity,
}: {
  serenity: SerenityScore | null;
}): ReactElement {
  if (serenity === null) {
    return <span className="fd-summary-figure">{MISSING}</span>;
  }
  const below = serenity.score < serenity.threshold;
  return (
    <span className="fd-summary-figure" data-below={below}>
      {serenity.score}
      {below ? (
        <>
          {' '}
          <span className="fd-summary-below">below threshold</span>
        </>
      ) : null}
      {serenity.firstScore === undefined ? null : (
        <>
          {' '}
          <span className="fd-summary-from">from {serenity.firstScore}</span>
        </>
      )}
    </span>
  );
}

function Details({
  pullRequest,
  checks,
  labels,
  reworked,
  frictions,
  renderLink,
}: Pick<
  IssueSummaryProps,
  'pullRequest' | 'checks' | 'labels' | 'reworked' | 'frictions'
> & { renderLink: RenderLink }): ReactElement | null {
  const rows: { term: string; value: ReactElement | string }[] = [];
  if (pullRequest !== null) {
    rows.push({
      term: 'Pull request',
      value: (
        <>
          <a href={pullRequest.url} target="_blank" rel="noreferrer">
            #{pullRequest.number}
          </a>{' '}
          {requestStateText(pullRequest).text}
        </>
      ),
    });
  }
  if (checks !== null) {
    rows.push({ term: 'Checks', value: CHECKS_TEXT[checks] });
  }
  if (labels !== null && labels.length > 0) {
    rows.push({ term: 'Labels', value: labels.join(', ') });
  }
  if (reworked !== null) {
    rows.push({ term: 'Reworked', value: reworked ? 'Yes' : 'No' });
  }
  if (frictions !== undefined) {
    rows.push({
      term: 'Frictions',
      value:
        frictions.count === 0
          ? NO_FRICTION
          : renderLink({
              href: frictions.href,
              children: formatCount(frictions.count),
            }),
    });
  }
  if (rows.length === 0) return null;
  return (
    <dl className="fd-summary-list">
      {rows.map((row) => (
        <Fragment key={row.term}>
          <dt>{row.term}</dt>
          <dd>{row.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

export function IssueSummary({
  total,
  orchestration,
  roles,
  serenity,
  rounds,
  pullRequest,
  checks,
  labels,
  reworked,
  frictions,
  lead,
  renderLink = renderAnchor,
}: IssueSummaryProps): ReactElement {
  return (
    <Aside>
      {lead}
      <div>
        <p className="fd-summary-label">Tokens</p>
        <Amount amount={total} size="figure" placement="below" />
        {orchestration === null ? null : (
          <p className="fd-summary-orchestration">
            Orchestration <Amount amount={orchestration} /> ·{' '}
            {wholePercent(
              totalTokens(orchestration.counts),
              totalTokens(total.counts),
            )}
            % of the tokens
          </p>
        )}
      </div>
      <div className="fd-summary-split">
        <SplitBar label="Tokens by role" segments={roles} height="medium" />
        <SplitLegend segments={roles} />
      </div>
      <div className="fd-summary-figures">
        <div>
          <p className="fd-summary-label">Serenity</p>
          <SerenityFigure serenity={serenity} />
        </div>
        <div>
          <p className="fd-summary-label">Review rounds</p>
          <span className="fd-summary-figure">
            {rounds === null ? MISSING : rounds}
          </span>
        </div>
      </div>
      <Details
        pullRequest={pullRequest}
        checks={checks}
        labels={labels}
        reworked={reworked}
        frictions={frictions}
        renderLink={renderLink}
      />
    </Aside>
  );
}
