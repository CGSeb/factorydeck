import type { ReactElement } from 'react';
import type { TeamCliConnection } from '../team/types.ts';
import { DataTable } from './components/DataTable.tsx';
import { Dialog } from './components/Dialog.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { formatAgo, formatDateTime, formatDay } from './format.ts';
import type { CliConnectionsView } from './team-cli-api.ts';
import { REFUSED_MESSAGE } from './team-view.ts';
import './team.css';
import './invitations.css';

export const NO_MACHINE = 'No machine connected.';
export const DISCONNECT = 'Disconnect';

export interface ConfirmingDisconnect {
  connection: TeamCliConnection;
  sending: boolean;
  error?: string | undefined;
}

export interface CliConnectionsDialogProps {
  name: string;
  view: CliConnectionsView | 'loading';
  now: Date;
  confirming?: ConfirmingDisconnect | undefined;
  onDisconnect: (connection: TeamCliConnection) => void;
  onConfirm: () => void;
  onCancelConfirm: () => void;
  onClose: () => void;
}

export function cliDialogTitle(name: string): string {
  return `${name}'s CLI connections`;
}

function stayOpen(): void {}

function ConnectionRow({
  connection,
  now,
  onDisconnect,
}: {
  connection: TeamCliConnection;
  now: Date;
  onDisconnect: (connection: TeamCliConnection) => void;
}): ReactElement {
  return (
    <tr>
      <th scope="row" className="fd-cli-machine">
        {connection.machine}
      </th>
      <td>
        <time
          dateTime={connection.createdAt}
          title={formatDateTime(connection.createdAt)}
        >
          {formatDay(connection.createdAt)}
        </time>
      </td>
      <td>
        <time
          dateTime={connection.lastUsedAt}
          title={formatDateTime(connection.lastUsedAt)}
        >
          {formatAgo(connection.lastUsedAt, now)}
        </time>
      </td>
      <td className="fd-invitation-actions">
        <button
          type="button"
          className="fd-control fd-invitation-button"
          aria-label={`${DISCONNECT} ${connection.machine}`}
          onClick={() => {
            onDisconnect(connection);
          }}
        >
          {DISCONNECT}
        </button>
      </td>
    </tr>
  );
}

function ConnectionsTable({
  name,
  connections,
  now,
  onDisconnect,
}: {
  name: string;
  connections: readonly TeamCliConnection[];
  now: Date;
  onDisconnect: (connection: TeamCliConnection) => void;
}): ReactElement {
  const label = cliDialogTitle(name);
  return (
    <DataTable label={label}>
      <table className="fd-team-table fd-cli-table" aria-label={label}>
        <thead>
          <tr>
            <th scope="col">Machine</th>
            <th scope="col">Connected</th>
            <th scope="col">Last used</th>
            <th scope="col">
              <span className="fd-visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {connections.map((connection) => (
            <ConnectionRow
              key={connection.id}
              connection={connection}
              now={now}
              onDisconnect={onDisconnect}
            />
          ))}
        </tbody>
      </table>
    </DataTable>
  );
}

function Connections({
  name,
  view,
  now,
  onDisconnect,
}: Pick<
  CliConnectionsDialogProps,
  'name' | 'view' | 'now' | 'onDisconnect'
>): ReactElement {
  if (view === 'loading') return <StatusLine>Loading…</StatusLine>;
  if (view.status === 'refused')
    return <StatusLine>{REFUSED_MESSAGE}</StatusLine>;
  if (view.status === 'failed') {
    return (
      <p className="fd-invitation-error" role="alert">
        {view.message}
      </p>
    );
  }
  if (view.connections.length === 0) {
    return <StatusLine>{NO_MACHINE}</StatusLine>;
  }
  return (
    <ConnectionsTable
      name={name}
      connections={view.connections}
      now={now}
      onDisconnect={onDisconnect}
    />
  );
}

function ConfirmDialog({
  confirming,
  onConfirm,
  onCancel,
}: {
  confirming: ConfirmingDisconnect;
  onConfirm: () => void;
  onCancel: () => void;
}): ReactElement {
  const { connection, sending, error } = confirming;
  return (
    <Dialog
      key={`confirm-${String(connection.id)}`}
      title={`${DISCONNECT} ${connection.machine}?`}
      text="Its CLI stops sending until you log in again."
      cancelLabel="Cancel"
      onCancel={sending ? stayOpen : onCancel}
      danger={{
        label: sending ? 'Disconnecting…' : DISCONNECT,
        onClick: onConfirm,
        disabled: sending,
      }}
    >
      <p className="fd-invitation-error" role="alert">
        {error}
      </p>
    </Dialog>
  );
}

export function CliConnectionsDialog({
  name,
  view,
  now,
  confirming,
  onDisconnect,
  onConfirm,
  onCancelConfirm,
  onClose,
}: CliConnectionsDialogProps): ReactElement {
  if (confirming !== undefined) {
    return (
      <ConfirmDialog
        confirming={confirming}
        onConfirm={onConfirm}
        onCancel={onCancelConfirm}
      />
    );
  }
  return (
    <Dialog
      key="list"
      title={cliDialogTitle(name)}
      text="The machines where this account's CLI is logged in."
      cancelLabel="Close"
      onCancel={onClose}
    >
      <Connections
        name={name}
        view={view}
        now={now}
        onDisconnect={onDisconnect}
      />
    </Dialog>
  );
}
