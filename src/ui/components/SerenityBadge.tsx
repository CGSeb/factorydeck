import type { ReactElement } from 'react';
import { pillStyle } from './label-styles.ts';

export interface SerenityScore {
  score: number;
  threshold: number;
}

export function SerenityBadge({
  report,
}: {
  report: SerenityScore | null;
}): ReactElement | null {
  if (report === null) return null;
  const passed = report.score >= report.threshold;
  const tone = passed ? 'success' : 'warning';
  return (
    <span data-tone={tone} style={pillStyle(tone)}>
      {passed
        ? `serenity ${report.score}`
        : `serenity ${report.score} · below threshold`}
    </span>
  );
}
