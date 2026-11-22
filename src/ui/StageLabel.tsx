import type { ReactElement } from 'react';
import type { IssueStage } from '../git-host/types.ts';

type Tone = 'success' | 'danger' | 'warning' | 'neutral';

export const STAGES: Record<IssueStage, { text: string; tone: Tone }> = {
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

export function StageLabel({ stage }: { stage: IssueStage }): ReactElement {
  const { text, tone } = STAGES[stage];
  return <span className={`state stage-${tone}`}>{text}</span>;
}
