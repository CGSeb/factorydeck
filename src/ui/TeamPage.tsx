import type { ReactElement } from 'react';
import type { TeamAccountRow } from '../team/types.ts';
import { PageHeader } from './components/PageHeader.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import type { WriteClipboard } from './frictions-api.ts';
import type { InvitationActions } from './invitations-api.ts';
import { InviteDialog } from './InviteDialog.tsx';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import type { ChangeRole } from './role-change-api.ts';
import type { LoadTeam, TeamView } from './team-api.ts';
import { type RowMessage, useTeamChanges } from './team-changes.ts';
import { REFUSED_MESSAGE, roleActionLabel, teamSummary } from './team-view.ts';
import {
  type TeamAction,
  type TeamActionsFor,
  TeamTable,
} from './TeamTable.tsx';
import { PendingInvitations } from './PendingInvitations.tsx';
import { type InvitationControls, useInvitations } from './use-invitations.ts';
import { useNow } from './use-now.ts';
import './team.css';

export interface TeamPageProps {
  loadTeam: LoadTeam;
  actionsFor?: TeamActionsFor | undefined;
  changeRole?: ChangeRole | undefined;
  now?: Date | undefined;
  invitationActions?: InvitationActions | undefined;
  origin?: string | undefined;
  copy?: WriteClipboard | undefined;
}

const LOADING = 'Loading…';
export const INVITE = 'Invite';

function TeamContent({
  view,
  now,
  actionsFor,
  busy,
  message,
}: {
  view: TeamView | undefined;
  now: Date;
  actionsFor: TeamActionsFor | undefined;
  busy: ReadonlySet<number>;
  message: RowMessage | undefined;
}): ReactElement {
  if (view === undefined) return <StatusLine>{LOADING}</StatusLine>;
  if (view.status === 'refused') {
    return <StatusLine>{REFUSED_MESSAGE}</StatusLine>;
  }
  if (view.status === 'unreachable') {
    return <StatusLine>{UNREACHABLE_MESSAGE}</StatusLine>;
  }
  return (
    <TeamTable
      accounts={view.accounts}
      now={now}
      actionsFor={actionsFor}
      busy={busy}
      message={message}
    />
  );
}

function inviteSlot(
  actions: InvitationActions | undefined,
  view: TeamView | undefined,
  open: () => void,
): { slot?: ReactElement } {
  if (actions === undefined || view?.status === 'refused') return {};
  return {
    slot: (
      <button
        type="button"
        className="fd-control fd-invite-button"
        onClick={open}
      >
        {INVITE}
      </button>
    ),
  };
}

function TeamInvitations({
  view,
  actions,
  invites,
  origin,
  copy,
}: {
  view: TeamView | undefined;
  actions: InvitationActions;
  invites: InvitationControls;
  origin: string;
  copy: WriteClipboard | undefined;
}): ReactElement {
  return (
    <>
      {view?.status === 'ok' && (
        <PendingInvitations
          invitations={invites.visible(view.invitations ?? [])}
          feedback={invites.feedback}
          onNewLink={invites.newLink}
          onRevoke={invites.revoke}
        />
      )}
      {invites.dialog !== undefined && (
        <InviteDialog
          view={invites.dialog}
          origin={origin}
          invite={actions.invite}
          onCreated={invites.created}
          onClose={invites.close}
          copy={copy}
        />
      )}
    </>
  );
}

export function TeamPage({
  loadTeam,
  actionsFor,
  changeRole,
  now: fixedNow,
  invitationActions,
  origin = window.location.origin,
  copy,
}: TeamPageProps): ReactElement {
  const { view, busy, message, run, reload } = useTeamChanges(loadTeam);
  const now = useNow(fixedNow);
  const invites = useInvitations(invitationActions, reload);
  function rowActions(account: TeamAccountRow): readonly TeamAction[] {
    const role: TeamAction[] =
      changeRole === undefined || !account.active
        ? []
        : [
            {
              label: roleActionLabel(account.role),
              onSelect: ({ id }) => {
                run(id, () =>
                  changeRole(
                    id,
                    account.role === 'manager' ? 'dev' : 'manager',
                  ),
                );
              },
            },
          ];
    return [...role, ...(actionsFor?.(account) ?? [])];
  }
  return (
    <div className="fd-team-page">
      <PageHeader
        title="Team"
        {...(view?.status === 'ok'
          ? { summary: teamSummary(view.accounts) }
          : {})}
        pending={view === undefined}
        {...inviteSlot(invitationActions, view, invites.open)}
      />
      <TeamContent
        view={view}
        now={now}
        actionsFor={rowActions}
        busy={busy}
        message={message}
      />
      {invitationActions !== undefined && (
        <TeamInvitations
          view={view}
          actions={invitationActions}
          invites={invites}
          origin={origin}
          copy={copy}
        />
      )}
    </div>
  );
}
