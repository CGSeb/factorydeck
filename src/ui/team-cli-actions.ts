import {
  type Dispatch,
  type ReactElement,
  type SetStateAction,
  createElement,
  useRef,
  useState,
} from 'react';
import type { TeamAccountRow, TeamCliConnection } from '../team/types.ts';
import {
  CliConnectionsDialog,
  type ConfirmingDisconnect,
} from './CliConnectionsDialog.tsx';
import type {
  CliConnectionsView,
  DisconnectOutcome,
  TeamCliActions,
} from './team-cli-api.ts';
import type { TeamAction } from './TeamTable.tsx';

export const CLI_CONNECTIONS = 'CLI connections';

interface Open {
  account: TeamAccountRow;
  view: CliConnectionsView | 'loading';
  confirming?: ConfirmingDisconnect | undefined;
}

export interface CliConnectionControls {
  action: TeamAction | undefined;
  dialog: ReactElement | undefined;
}

function afterDisconnect(
  view: Open['view'],
  outcome: DisconnectOutcome,
  connectionId: number,
): Open['view'] {
  if (outcome.status === 'refused') return outcome;
  if (view === 'loading' || view.status !== 'ok') return view;
  return {
    status: 'ok',
    connections: view.connections.filter(({ id }) => id !== connectionId),
  };
}

type SetOpen = Dispatch<SetStateAction<Open | undefined>>;

function confirmingSetter(
  setOpen: SetOpen,
): (confirming: ConfirmingDisconnect | undefined) => void {
  return (confirming) => {
    setOpen((current) =>
      current === undefined ? current : { ...current, confirming },
    );
  };
}

function disconnect(
  cli: TeamCliActions,
  {
    account,
    connection,
  }: { account: TeamAccountRow; connection: TeamCliConnection },
  setOpen: SetOpen,
  onDone: () => void,
): void {
  const setConfirming = confirmingSetter(setOpen);
  setConfirming({ connection, sending: true });
  void cli.disconnect(account.id, connection.id).then((outcome) => {
    if (outcome.status === 'failed') {
      setConfirming({ connection, sending: false, error: outcome.message });
      return;
    }
    onDone();
    setOpen((current) =>
      current === undefined
        ? current
        : {
            account: current.account,
            view: afterDisconnect(current.view, outcome, connection.id),
          },
    );
  });
}

function openFor(
  cli: TeamCliActions,
  account: TeamAccountRow,
  setOpen: SetOpen,
): void {
  setOpen({ account, view: 'loading' });
  void cli.load(account.id).then((view) => {
    setOpen((current) =>
      current?.account.id === account.id ? { ...current, view } : current,
    );
  });
}

export function useCliConnections(
  actions: TeamCliActions | undefined,
  reload: () => void,
  now: Date,
): CliConnectionControls {
  const [open, setOpen] = useState<Open>();
  const changed = useRef(false);
  if (actions === undefined) return { action: undefined, dialog: undefined };
  const cli = actions;
  const setConfirming = confirmingSetter(setOpen);
  return {
    action: {
      label: CLI_CONNECTIONS,
      forYou: true,
      onSelect: (account) => {
        changed.current = false;
        openFor(cli, account, setOpen);
      },
    },
    dialog:
      open === undefined
        ? undefined
        : createElement(CliConnectionsDialog, {
            name: open.account.name,
            view: open.view,
            now,
            confirming: open.confirming,
            onDisconnect: (connection) => {
              setConfirming({ connection, sending: false });
            },
            onConfirm: () => {
              if (open.confirming === undefined) return;
              disconnect(
                cli,
                {
                  account: open.account,
                  connection: open.confirming.connection,
                },
                setOpen,
                () => {
                  changed.current = true;
                },
              );
            },
            onCancelConfirm: () => {
              setConfirming(undefined);
            },
            onClose: () => {
              setOpen(undefined);
              if (changed.current) reload();
              changed.current = false;
            },
          }),
  };
}
