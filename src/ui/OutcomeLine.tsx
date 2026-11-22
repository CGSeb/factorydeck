import type { ReactElement } from 'react';
import type { IssueOutcome } from '../git-host/types.ts';
import { StageLabel } from './StageLabel.tsx';

const MISSING = '—';

function roundsText(rounds: number | null | undefined): string {
  if (rounds === null || rounds === undefined) {
    return `${MISSING} review rounds`;
  }
  return `${String(rounds)} review ${rounds === 1 ? 'round' : 'rounds'}`;
}

export function OutcomeLine({
  outcome,
}: {
  outcome: IssueOutcome;
}): ReactElement {
  const { report } = outcome;
  const below = report !== null && report.score < report.threshold;
  return (
    <dl className="outcome">
      <dt>Outcome</dt>
      <dd>
        <StageLabel stage={outcome.stage} />
        <span className={below ? 'serenity serenity-below' : 'serenity'}>
          {report === null
            ? `Serenity ${MISSING}`
            : `Serenity ${String(report.score)}/100 (threshold ${String(report.threshold)})`}
          {below && ' below threshold'}
        </span>
        <span>{roundsText(report?.rounds)}</span>
        {outcome.reworked && <span>Reworked</span>}
      </dd>
    </dl>
  );
}
