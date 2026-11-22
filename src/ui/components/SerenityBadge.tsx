import type { ReactElement } from 'react';
import { pillStyle } from './label-styles.ts';

export interface SerenityScore {
  score: number;
  threshold: number;
  firstScore?: number;
}

export function serenityScore(report: SerenityScore): SerenityScore {
  return report.firstScore === undefined
    ? { score: report.score, threshold: report.threshold }
    : {
        score: report.score,
        threshold: report.threshold,
        firstScore: report.firstScore,
      };
}

export function SerenityBadge({
  report,
}: {
  report: SerenityScore | null;
}): ReactElement | null {
  if (report === null) return null;
  const passed = report.score >= report.threshold;
  const tone = passed ? 'success' : 'warning';
  const score =
    report.firstScore === undefined
      ? `serenity ${report.score}`
      : `serenity ${report.firstScore} → ${report.score}`;
  return (
    <span data-tone={tone} style={pillStyle(tone)}>
      {passed ? score : `${score} · below threshold`}
    </span>
  );
}
