import type { ReactElement } from 'react';
import type { SessionState } from '../../sessions/types.ts';
import { type Tone, dotStyle, pillStyle } from './label-styles.ts';

export const SESSION_STATE_BADGES: Record<
  SessionState,
  { text: string; tone: Tone; dot: string }
> = {
  working: { text: 'Working', tone: 'info', dot: 'var(--fd-stage-working)' },
  waiting: {
    text: 'Waiting for you',
    tone: 'warning',
    dot: 'var(--fd-stage-review)',
  },
  inactive: {
    text: 'Inactive',
    tone: 'neutral',
    dot: 'var(--fd-stage-ready)',
  },
};

export function SessionStateBadge({
  state,
}: {
  state: SessionState;
}): ReactElement {
  const { text, tone, dot } = SESSION_STATE_BADGES[state];
  return (
    <span data-tone={tone} style={pillStyle(tone)}>
      <span aria-hidden="true" style={dotStyle(7, '50%', dot)} />
      {text}
    </span>
  );
}
