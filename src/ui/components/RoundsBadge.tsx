import type { ReactElement } from 'react';
import { pillStyle } from './label-styles.ts';

export function RoundsBadge({
  rounds,
  inReview = false,
}: {
  rounds: number | null;
  inReview?: boolean;
}): ReactElement | null {
  if (rounds === null) return null;
  const tone = inReview ? 'warning' : 'neutral';
  const text = inReview
    ? `round ${rounds}`
    : `${rounds} review ${rounds === 1 ? 'round' : 'rounds'}`;
  return (
    <span data-tone={tone} style={pillStyle(tone)}>
      {text}
    </span>
  );
}
