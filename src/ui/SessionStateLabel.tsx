import type { ReactElement } from 'react';
import type { SessionState } from '../sessions/types.ts';

export const STATE_LABELS: Record<SessionState, string> = {
  working: 'Working',
  waiting: 'Waiting for you',
  inactive: 'Inactive',
};

export function SessionStateLabel({
  state,
}: {
  state: SessionState;
}): ReactElement {
  return <span className={`state state-${state}`}>{STATE_LABELS[state]}</span>;
}
