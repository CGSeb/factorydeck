import type { TeamAccountRow } from '../team/types.ts';
import { MISSING, formatCount } from './format.ts';

export const REFUSED_MESSAGE = 'Only managers can manage the team.';
export const NEVER = 'Never';

function counted(count: number, noun: string): string {
  return `${formatCount(count)} ${noun}${count === 1 ? '' : 's'}`;
}

export function teamSummary(accounts: readonly TeamAccountRow[]): string {
  const managers = accounts.filter(({ role }) => role === 'manager').length;
  return `${counted(accounts.length, 'account')} · ${counted(managers, 'manager')}`;
}

export function roleLabel(role: TeamAccountRow['role']): string {
  return role === 'manager' ? 'Manager' : 'Dev';
}

export function statusLabel(active: boolean): string {
  return active ? 'Active' : 'Deactivated';
}

export function roleActionLabel(role: TeamAccountRow['role']): string {
  return role === 'manager' ? 'Make dev' : 'Make manager';
}

export const REACTIVATING = 'Reactivating…';

export function busyLabelOf(
  account: TeamAccountRow,
  busy: boolean,
): string | undefined {
  return busy && !account.active ? REACTIVATING : undefined;
}

export function cliCountLabel(count: number): string {
  return count === 0 ? MISSING : formatCount(count);
}
