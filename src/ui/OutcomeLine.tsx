import type { ReactElement } from 'react';
import type { IssueOutcome, IssueStage } from '../git-host/types.ts';

type Tone = 'success' | 'danger' | 'warning' | 'neutral';

const STAGES: Record<IssueStage, { text: string; tone: Tone }> = {
  merged: { text: 'Merged', tone: 'success' },
  'merged-by-person': { text: 'Merged by a person', tone: 'success' },
  closed: { text: 'Closed without merge', tone: 'danger' },
  blocked: { text: 'Blocked', tone: 'danger' },
  'needs-spec': { text: 'Needs spec', tone: 'warning' },
  'in-review': { text: 'In review', tone: 'neutral' },
  working: { text: 'Working', tone: 'neutral' },
  ready: { text: 'Ready', tone: 'neutral' },
  open: { text: 'Open', tone: 'neutral' },
};

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
  const stage = STAGES[outcome.stage];
  const below = report !== null && report.score < report.threshold;
  return (
    <dl className="outcome">
      <dt>Outcome</dt>
      <dd>
        <span className={`state stage-${stage.tone}`}>{stage.text}</span>
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
