import type { ReactElement } from 'react';
import type { IssueStage } from '../../git-host/types.ts';
import { type Tone, pillStyle } from './label-styles.ts';

export const STAGE_BADGES: Record<IssueStage, { text: string; tone: Tone }> = {
  merged: { text: 'Merged', tone: 'success' },
  'merged-by-person': { text: 'Merged by a person', tone: 'success' },
  'merged-after-person': { text: 'Merged after a person', tone: 'success' },
  closed: { text: 'Closed without merge', tone: 'danger' },
  blocked: { text: 'Blocked', tone: 'danger' },
  'needs-spec': { text: 'Needs spec', tone: 'warning' },
  'in-review': { text: 'In review', tone: 'neutral' },
  working: { text: 'Working', tone: 'neutral' },
  ready: { text: 'Ready', tone: 'neutral' },
  open: { text: 'Open', tone: 'neutral' },
};

export function StageBadge({ stage }: { stage: IssueStage }): ReactElement {
  const { text, tone } = STAGE_BADGES[stage];
  return (
    <span data-tone={tone} style={pillStyle(tone)}>
      {text}
    </span>
  );
}
