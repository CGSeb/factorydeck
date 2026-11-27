import { type ReactElement, createElement, useState } from 'react';
import type { TeamAccountRow } from '../team/types.ts';
import type { ChangeActive } from './account-status-api.ts';
import { DeactivateDialog } from './DeactivateDialog.tsx';
import type { AccountChangeOutcome } from './role-change-api.ts';
import type { TeamAction } from './TeamTable.tsx';

export type RunChange = (
  accountId: number,
  send: () => Promise<AccountChangeOutcome>,
) => void;

export interface StatusActions {
  actionsFor: (
    account: TeamAccountRow,
    others: readonly TeamAction[],
  ) => readonly TeamAction[];
  dialog: ReactElement | undefined;
}

interface Confirming {
  account: TeamAccountRow;
  sending: boolean;
}

export function useStatusActions(
  changeActive: ChangeActive | undefined,
  run: RunChange,
): StatusActions {
  const [confirming, setConfirming] = useState<Confirming>();
  if (changeActive === undefined) {
    return { actionsFor: (_, others) => others, dialog: undefined };
  }
  function deactivate(account: TeamAccountRow, change: ChangeActive): void {
    setConfirming({ account, sending: true });
    run(account.id, async () => {
      const outcome = await change(account.id, false);
      setConfirming(undefined);
      return outcome;
    });
  }
  return {
    actionsFor: (account, others) =>
      account.active
        ? [
            ...others,
            {
              label: 'Deactivate',
              danger: true,
              onSelect: (chosen) => {
                setConfirming({ account: chosen, sending: false });
              },
            },
          ]
        : [
            {
              label: 'Reactivate',
              onSelect: ({ id }) => {
                run(id, () => changeActive(id, true));
              },
            },
          ],
    dialog:
      confirming === undefined
        ? undefined
        : createElement(DeactivateDialog, {
            name: confirming.account.name,
            deactivating: confirming.sending,
            onCancel: () => {
              setConfirming(undefined);
            },
            onConfirm: () => {
              deactivate(confirming.account, changeActive);
            },
          }),
  };
}
