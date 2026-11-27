import type { TeamAccountRow } from '../team/types.ts';
import { formatCount } from './format.ts';

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
