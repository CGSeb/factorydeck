import type { Database } from '../db/client.ts';
import { account } from '../db/schema.ts';
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

export async function teamAccounts(db: Database): Promise<TeamAccount[]> {
  const rows = await db
    .select({
      id: account.id,
      name: account.name,
      email: account.email,
      role: account.role,
      active: account.active,
      lastSignInAt: account.lastSignInAt,
    })
    .from(account);
  return rows
    .map((row) => ({
      ...row,
      lastSignInAt: row.lastSignInAt?.toISOString() ?? null,
    }))
    .sort(byTeamOrder);
}
