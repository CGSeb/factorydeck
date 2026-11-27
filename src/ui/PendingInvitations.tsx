import type { ReactElement } from 'react';
import type { TeamInvitation } from '../team/types.ts';
import { DataTable } from './components/DataTable.tsx';
import { MISSING, formatDateTime } from './format.ts';
import { roleLabel } from './team-view.ts';
import './team.css';
import './invitations.css';

export const PENDING_TITLE = 'Pending invitations';
export const NEW_LINK = 'New link';
export const REVOKE = 'Revoke';

export interface RowFeedback {
  busy?: boolean | undefined;
  error?: string | undefined;
}

export interface PendingInvitationsProps {
  invitations: readonly TeamInvitation[];
  feedback?: Readonly<Record<number, RowFeedback>> | undefined;
  onNewLink: (invitation: TeamInvitation) => void;
  onRevoke: (invitation: TeamInvitation) => void;
}

function InvitationRow({
  invitation,
  feedback,
  onNewLink,
  onRevoke,
}: {
  invitation: TeamInvitation;
  feedback: RowFeedback | undefined;
  onNewLink: (invitation: TeamInvitation) => void;
  onRevoke: (invitation: TeamInvitation) => void;
}): ReactElement {
  const busy = feedback?.busy === true;
  const errorId = `fd-invitation-${invitation.id}-error`;
  const described = feedback?.error === undefined ? undefined : errorId;
  return (
    <tr>
      <th scope="row" className="fd-team-email">
        {invitation.email}
      </th>
      <td>{roleLabel(invitation.role)}</td>
      <td className="fd-invitation-by">{invitation.invitedBy ?? MISSING}</td>
      <td>
        <time dateTime={invitation.expiresAt}>
          {formatDateTime(invitation.expiresAt)}
        </time>
      </td>
      <td className="fd-invitation-actions">
        <div className="fd-invitation-buttons">
          <button
            type="button"
            className="fd-control fd-invitation-button"
            aria-label={`${NEW_LINK} for ${invitation.email}`}
            aria-describedby={described}
            disabled={busy}
            onClick={() => {
              onNewLink(invitation);
            }}
          >
            {NEW_LINK}
          </button>
          <button
            type="button"
            className="fd-control fd-invitation-button"
            aria-label={`${REVOKE} the invitation of ${invitation.email}`}
            aria-describedby={described}
            disabled={busy}
            onClick={() => {
              onRevoke(invitation);
            }}
          >
            {REVOKE}
          </button>
        </div>
        <p id={errorId} className="fd-invitation-error" role="alert">
          {feedback?.error}
        </p>
      </td>
    </tr>
  );
}

export function PendingInvitations({
  invitations,
  feedback = {},
  onNewLink,
  onRevoke,
}: PendingInvitationsProps): ReactElement | null {
  if (invitations.length === 0) return null;
  return (
    <div className="fd-invitations">
      <h2 id="fd-invitations-title" className="fd-invitations-title">
        {PENDING_TITLE}
      </h2>
      <DataTable label={PENDING_TITLE}>
        <table className="fd-team-table" aria-label={PENDING_TITLE}>
          <thead>
            <tr>
              <th scope="col">Email</th>
              <th scope="col">Role</th>
              <th scope="col">Invited by</th>
              <th scope="col">Expires</th>
              <th scope="col">
                <span className="fd-visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((invitation) => (
              <InvitationRow
                key={invitation.id}
                invitation={invitation}
                feedback={feedback[invitation.id]}
                onNewLink={onNewLink}
                onRevoke={onRevoke}
              />
            ))}
          </tbody>
        </table>
      </DataTable>
    </div>
  );
}
