import type { ReactElement } from 'react';
import { dotStyle } from './label-styles.ts';

export const STAGE_GROUPS = [
  'ready',
  'working',
  'in-review',
  'merged',
] as const;

export type StageGroup = (typeof STAGE_GROUPS)[number];

export const STAGE_GROUP_COLORS: Record<StageGroup, string> = {
  ready: 'var(--fd-stage-ready)',
  working: 'var(--fd-stage-working)',
  'in-review': 'var(--fd-stage-review)',
  merged: 'var(--fd-stage-merged)',
};

export function StageDot({ group }: { group: StageGroup }): ReactElement {
  return (
    <span
      aria-hidden="true"
      data-group={group}
      style={dotStyle(8, '50%', STAGE_GROUP_COLORS[group])}
    />
  );
}
