import type { Database } from '../db/client.ts';
import { teamRows } from './team-columns.ts';
import type { TeamAccount } from './types.ts';

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  return left > right ? 1 : 0;
}

export function byTeamOrder(left: TeamAccount, right: TeamAccount): number {
  return (
    Number(right.active) - Number(left.active) ||
    compareText(left.name.toLowerCase(), right.name.toLowerCase()) ||
    compareText(left.email, right.email)
  );
}

export async function teamAccounts(
  db: Database,
  now: Date = new Date(),
): Promise<TeamAccount[]> {
  return (await teamRows(db, now)).sort(byTeamOrder);
}
