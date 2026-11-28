import { type ReactElement, useRef } from 'react';
import { Route } from 'react-router';
import { DataTable } from './components/DataTable.tsx';
import { Dialog } from './components/Dialog.tsx';
import { PageHeader } from './components/PageHeader.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import type {
  CliConnectionItem,
  CliConnectionsView,
  DisconnectCliConnection,
  LoadCliConnections,
} from './cli-connections-api.ts';
import {
  CLI_CONNECTIONS_TITLE,
  DISCONNECT,
  DISCONNECTING,
  DISCONNECT_TEXT,
  disconnectTitle,
  loginCommand,
  machinesSummary,
} from './cli-connections-view.ts';
import { formatAgo, formatDateTime } from './format.ts';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import { formatAddedDate } from './projects-view.ts';
import {
  useConnections,
  useDisconnect,
  useRowFocus,
} from './cli-connections-state.ts';
import { useNow } from './use-now.ts';
import './DeleteProjectDialog.css';
import './invitations.css';
import './cli-connections.css';

export interface CliConnectionsPageProps {
  loadCliConnections: LoadCliConnections;
  disconnectCliConnection: DisconnectCliConnection;
  origin?: string | undefined;
  now?: Date | undefined;
}

const LOADING = 'Loading…';

function ConnectionRow({
  connection,
  now,
  onDisconnect,
}: {
  connection: CliConnectionItem;
  now: Date;
  onDisconnect: (connection: CliConnectionItem) => void;
}): ReactElement {
  return (
    <tr>
      <th scope="row">{connection.machine}</th>
      <td>
        <time
          dateTime={connection.createdAt}
          title={formatDateTime(connection.createdAt)}
        >
          {formatAddedDate(connection.createdAt)}
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
  connections,
  now,
  onDisconnect,
}: {
  connections: readonly CliConnectionItem[];
  now: Date;
  onDisconnect: (connection: CliConnectionItem) => void;
}): ReactElement {
  return (
    <DataTable label={CLI_CONNECTIONS_TITLE}>
      <table
        className="fd-cli-connections-table"
        aria-label={CLI_CONNECTIONS_TITLE}
      >
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

function EmptyLine({ origin }: { origin: string }): ReactElement {
  return (
    <StatusLine>
      No machine connected. Run <code>{loginCommand(origin)}</code> in a
      terminal.
    </StatusLine>
  );
}

function stayOpen(): void {}

function DisconnectDialog({
  machine,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  machine: string;
  busy: boolean;
  error: string | undefined;
  onCancel: () => void;
  onConfirm: () => void;
}): ReactElement {
  return (
    <Dialog
      title={disconnectTitle(machine)}
      text={DISCONNECT_TEXT}
      cancelLabel="Cancel"
      onCancel={busy ? stayOpen : onCancel}
      danger={{
        label: busy ? DISCONNECTING : DISCONNECT,
        onClick: onConfirm,
        disabled: busy,
      }}
    >
      {error === undefined ? undefined : (
        <p className="fd-dialog-message" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}

function ConnectionsContent({
  view,
  origin,
  now,
  onDisconnect,
}: {
  view: CliConnectionsView | undefined;
  origin: string;
  now: Date;
  onDisconnect: (connection: CliConnectionItem) => void;
}): ReactElement {
  if (view === undefined) return <StatusLine>{LOADING}</StatusLine>;
  if (view.status === 'unreachable') {
    return <StatusLine>{UNREACHABLE_MESSAGE}</StatusLine>;
  }
  if (view.connections.length === 0) return <EmptyLine origin={origin} />;
  return (
    <ConnectionsTable
      connections={view.connections}
      now={now}
      onDisconnect={onDisconnect}
    />
  );
}

export function CliConnectionsPage({
  loadCliConnections,
  disconnectCliConnection,
  origin = window.location.origin,
  now: fixedNow,
}: CliConnectionsPageProps): ReactElement {
  const now = useNow(fixedNow);
  const page = useRef<HTMLDivElement>(null);
  const focusRow = useRowFocus(page);
  const { view, removed } = useConnections(loadCliConnections);
  const { confirming, ask, cancel, confirm } = useDisconnect(
    disconnectCliConnection,
    (connection) => {
      const rows = view?.status === 'ok' ? view.connections : [];
      focusRow(
        Math.max(
          0,
          rows.findIndex(({ id }) => id === connection.id),
        ),
      );
      removed(connection.id);
    },
  );
  return (
    <div ref={page} className="fd-cli-connections-page" tabIndex={-1}>
      <PageHeader
        title={CLI_CONNECTIONS_TITLE}
        {...(view?.status === 'ok'
          ? { summary: machinesSummary(view.connections.length) }
          : {})}
        pending={view === undefined}
      />
      <ConnectionsContent
        view={view}
        origin={origin}
        now={now}
        onDisconnect={ask}
      />
      {confirming !== undefined && (
        <DisconnectDialog
          machine={confirming.connection.machine}
          busy={confirming.busy}
          error={confirming.error}
          onCancel={cancel}
          onConfirm={confirm}
        />
      )}
    </div>
  );
}

export interface CliConnectionsSources {
  loadCliConnections?: LoadCliConnections | undefined;
  disconnectCliConnection?: DisconnectCliConnection | undefined;
}

export function cliConnectionsRoute({
  loadCliConnections,
  disconnectCliConnection,
}: CliConnectionsSources): ReactElement | undefined {
  if (
    loadCliConnections === undefined ||
    disconnectCliConnection === undefined
  ) {
    return undefined;
  }
  return (
    <Route
      path="account/cli"
      element={
        <CliConnectionsPage
          loadCliConnections={loadCliConnections}
          disconnectCliConnection={disconnectCliConnection}
        />
      }
    />
  );
}
