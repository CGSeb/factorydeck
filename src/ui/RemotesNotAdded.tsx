import type { ReactElement } from 'react';
import { DataTable } from './components/DataTable.tsx';
import { MISSING, formatAgo, formatDateTime } from './format.ts';
import type { NoRemote, PendingRemote } from './projects-api.ts';
import { NO_REMOTE, REMOTES_NOT_ADDED, counted } from './projects-view.ts';
import './invitations.css';
import './projects.css';

export const ADD_REMOTE = 'Add';

export interface RemotesNotAddedProps {
  pendingRemotes: readonly PendingRemote[];
  noRemote: NoRemote | null;
  now: Date;
  onAdd?: ((remote: string) => void) | undefined;
}

function SessionTime({
  at,
  now,
}: {
  at: string | null;
  now: Date;
}): ReactElement {
  if (at === null) return <>{MISSING}</>;
  return (
    <time dateTime={at} title={formatDateTime(at)}>
      {formatAgo(at, now)}
    </time>
  );
}

function RemoteRow({
  line,
  now,
  onAdd,
}: {
  line: PendingRemote;
  now: Date;
  onAdd: ((remote: string) => void) | undefined;
}): ReactElement {
  return (
    <tr>
      <th scope="row" className="fd-projects-remote">
        {line.remote}
      </th>
      <td>{counted(line.sessions, 'session')}</td>
      <td>
        <SessionTime at={line.firstAt} now={now} />
      </td>
      <td>
        <SessionTime at={line.lastAt} now={now} />
      </td>
      <td className="fd-projects-actions">
        {onAdd !== undefined && (
          <button
            type="button"
            className="fd-control fd-invitation-button"
            aria-label={`${ADD_REMOTE} ${line.remote}`}
            onClick={() => {
              onAdd(line.remote);
            }}
          >
            {ADD_REMOTE}
          </button>
        )}
      </td>
    </tr>
  );
}

function NoRemoteRow({ noRemote }: { noRemote: NoRemote }): ReactElement {
  return (
    <tr>
      <th scope="row" className="fd-projects-remote">
        {NO_REMOTE}{' '}
        <span className="fd-projects-folders">
          {counted(noRemote.folders, 'folder')}
        </span>
      </th>
      <td>{counted(noRemote.sessions, 'session')}</td>
      <td />
      <td />
      <td />
    </tr>
  );
}

export function RemotesNotAdded({
  pendingRemotes,
  noRemote,
  now,
  onAdd,
}: RemotesNotAddedProps): ReactElement | null {
  if (pendingRemotes.length === 0 && noRemote === null) return null;
  return (
    <div className="fd-invitations">
      <h2 className="fd-invitations-title">{REMOTES_NOT_ADDED}</h2>
      <DataTable label={REMOTES_NOT_ADDED}>
        <table className="fd-projects-table" aria-label={REMOTES_NOT_ADDED}>
          <thead>
            <tr>
              <th scope="col">Remote</th>
              <th scope="col">Sessions</th>
              <th scope="col">First session</th>
              <th scope="col">Last session</th>
              <th scope="col">
                <span className="fd-visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pendingRemotes.map((line) => (
              <RemoteRow
                key={line.remote}
                line={line}
                now={now}
                onAdd={onAdd}
              />
            ))}
            {noRemote !== null && <NoRemoteRow noRemote={noRemote} />}
          </tbody>
        </table>
      </DataTable>
    </div>
  );
}
