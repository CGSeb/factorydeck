import type { BugCounts, BugFix, BugGroup, BugRow } from '../bugs/types.ts';
import type { Reproduced } from '../git-host/types.ts';
import type { Tone } from './components/label-styles.ts';
import { MISSING, formatElapsed } from './format.ts';

export const BUG_PAGE_ROWS = 20;

export const BUG_GROUP_LABELS: Record<BugGroup, string> = {
  open: 'Open',
  fixing: 'Fixing',
  fixed: 'Fixed',
};

export const NO_BUG_TEXT = 'No open bug, and no bug fixed in this period.';

export const NO_BUG_TICKETS_TEXT =
  'No project here uses bug tickets. Run /setup-factory in a project to add them.';

const REPRODUCED_TEXTS: Record<Reproduced, { text: string; tone: Tone }> = {
  'failed-on-main': { text: 'Failed on main', tone: 'success' },
  'passed-on-main': { text: 'Passed on main', tone: 'warning' },
  'did-not-run-on-main': { text: 'Did not run on main', tone: 'warning' },
  'no-test': { text: 'No test', tone: 'warning' },
};

export function reproducedOf(fix: BugFix | null): {
  text: string;
  tone: Tone | null;
} {
  const value = fix?.reproduced ?? null;
  return value === null
    ? { text: MISSING, tone: null }
    : REPRODUCED_TEXTS[value];
}

function between(from: string, to: string | number): string {
  const end = typeof to === 'number' ? to : Date.parse(to);
  return formatElapsed(end - Date.parse(from));
}

export function ageText(row: BugRow, group: BugGroup, now: Date): string {
  const start = row.version.startedAt;
  if (group !== 'fixed') {
    return `Open for ${between(start, now.getTime())}`;
  }
  if (row.mergedAt !== null) return `Fixed in ${between(start, row.mergedAt)}`;
  if (row.closedAt !== null) {
    return `Closed after ${between(start, row.closedAt)}`;
  }
  return MISSING;
}

export function bugSummary({ open, fixed, closed }: BugCounts): string {
  const base = `${String(open)} open · ${String(fixed)} fixed`;
  return closed === 0
    ? base
    : `${base} · ${String(closed)} closed without a fix`;
}
