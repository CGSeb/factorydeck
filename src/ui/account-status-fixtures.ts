import type { TeamAccountRow } from '../team/types.ts';
import type { ChangeActive } from './account-status-api.ts';
import type { AccountChangeOutcome } from './role-change-api.ts';
import { someTeam } from './team-fixtures.ts';

function rowOf(id: number): TeamAccountRow {
  const row = someTeam.find((account) => account.id === id);
  if (row === undefined) throw new Error(`No account ${String(id)}`);
  return row;
}

export function changeApplied(): ChangeActive {
  return (id: number, active: boolean) =>
    Promise.resolve({ status: 'changed', account: { ...rowOf(id), active } });
}

export function changeAnswering(answer: AccountChangeOutcome): ChangeActive {
  return () => Promise.resolve(answer);
}

export function pendingChange(): ChangeActive {
  return () => new Promise<AccountChangeOutcome>(() => undefined);
}

export function changeFailing(message: string): ChangeActive {
  return changeAnswering({ status: 'failed', message });
}
