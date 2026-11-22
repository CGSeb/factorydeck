import type { ReactElement } from 'react';
import type { IssueOutcome } from '../git-host/types.ts';
import type { SessionDetail } from '../sessions/types.ts';
import { RoundsBadge } from './components/RoundsBadge.tsx';
import { SerenityBadge } from './components/SerenityBadge.tsx';
import { SplitBar } from './components/SplitBar.tsx';
import { SplitLegend } from './components/SplitLegend.tsx';
import { StageBadge } from './components/StageBadge.tsx';
import { TokenAmount } from './components/TokenAmount.tsx';
import { MISSING, formatDateTime } from './format.ts';
import { kindSegments } from './session-detail.ts';
import './sessions.css';

function Outcome({ outcome }: { outcome: IssueOutcome }): ReactElement {
  return (
    <div className="fd-aside-block">
      <span className="fd-aside-label">Outcome</span>
      <span className="fd-aside-badges">
        <StageBadge stage={outcome.stage} />
        <SerenityBadge report={outcome.report} />
        <RoundsBadge
          rounds={outcome.report?.rounds ?? null}
          inReview={outcome.stage === 'in-review'}
        />
      </span>
    </div>
  );
}

export function SessionAside({
  session,
}: {
  session: SessionDetail;
}): ReactElement {
  const segments = kindSegments(session);
  return (
    <>
      <div className="fd-aside-block">
        <span className="fd-aside-label">Tokens, sub-agents included</span>
        <span>
          <TokenAmount
            counts={session.tokens}
            costUsd={session.costUsd}
            size="figure"
            placement="below"
          />
        </span>
      </div>
      <div className="fd-aside-block">
        <SplitBar label="Tokens by kind" segments={segments} height="medium" />
        <SplitLegend segments={segments} />
      </div>
      {session.workItem !== null && session.issueDetail !== null && (
        <Outcome outcome={session.issueDetail.outcome} />
      )}
      <dl className="fd-session-facts">
        <div>
          <dt>Working directory</dt>
          <dd className="fd-session-mono fd-session-anywhere">
            {session.cwd ?? MISSING}
          </dd>
        </div>
        <div>
          <dt>First activity</dt>
          <dd>{formatDateTime(session.firstAt)}</dd>
        </div>
        <div>
          <dt>Last activity</dt>
          <dd>{formatDateTime(session.lastAt)}</dd>
        </div>
      </dl>
    </>
  );
}
