export interface DemoIssue {
  number: number;
  title: string;
  closed: boolean;
  labels: string[];
  daysAgo: number;
  closedDaysAgo?: number;
  needsSpec?: boolean;
  needsSpecAt?: { addedDaysAgo: number; removedDaysAgo: number | null };
}

export interface DemoRequest {
  number: number;
  title: string;
  state: 'open' | 'merged' | 'closed';
  closes: number[];
  checks: string;
  hoursAgo: number;
  draft?: boolean;
  report?: string;
  refusedReport?: string;
  extraReport?: { body: string; lead: number };
  reportLead?: number;
}

function reviewText(rounds: number | null): string {
  if (rounds === null) return '';
  return ` Review: ${String(rounds)} ${rounds === 1 ? 'round' : 'rounds'}, confidence high.`;
}

export function serenityReport(
  score: number,
  rounds: number | null,
  gatesPassed = true,
): string {
  return [
    `## Serenity: ${String(score)}/100 (threshold 80)`,
    '',
    '- −10: a demo deduction',
    '',
    `Gates: ${gatesPassed ? 'all passed' : '1 failed'}.${reviewText(rounds)}`,
  ].join('\n');
}
