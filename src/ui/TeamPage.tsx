import type { ReactElement, RefObject } from 'react';
import { Route } from 'react-router';
import type { ChangeActive } from './account-status-api.ts';
import type { TeamAccountRow } from '../team/types.ts';
import { PageHeader } from './components/PageHeader.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { type WriteClipboard, writeClipboard } from './frictions-api.ts';
import type { InvitationActions } from './invitations-api.ts';
import { InviteDialog } from './InviteDialog.tsx';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import type { CreateResetLink } from './reset-api.ts';
import { useTeamResetRows } from './ResetLinkPanel.tsx';
import type { ChangeRole } from './role-change-api.ts';
import type { LoadTeam, TeamView } from './team-api.ts';
import { type RowMessage, useTeamChanges } from './team-changes.ts';
import { REFUSED_MESSAGE, roleActionLabel, teamSummary } from './team-view.ts';
import {
  type TeamAction,
  type TeamActionsFor,
  type TeamTableProps,
  TeamTable,
} from './TeamTable.tsx';
import { PendingInvitations } from './PendingInvitations.tsx';
import { type InvitationControls, useInvitations } from './use-invitations.ts';
import { type RunChange, useStatusActions } from './team-status-actions.ts';
import { useNow } from './use-now.ts';
import './team.css';

export interface TeamPageProps {
  loadTeam: LoadTeam;
  actionsFor?: TeamActionsFor | undefined;
  changeRole?: ChangeRole | undefined;
  changeActive?: ChangeActive | undefined;
  createResetLink?: CreateResetLink | undefined;
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
  below,
}: {
  view: TeamView | undefined;
  now: Date;
  actionsFor: TeamActionsFor | undefined;
  busy: ReadonlySet<number>;
  message: RowMessage | undefined;
  below: NonNullable<TeamTableProps['below']>;
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
      below={below}
    />
  );
}

function inviteSlot(
  actions: InvitationActions | undefined,
  view: TeamView | undefined,
  open: () => void,
  button: RefObject<HTMLButtonElement | null>,
): { slot?: ReactElement } {
  if (actions === undefined || view?.status !== 'ok') return {};
  return {
    slot: (
      <button
        ref={button}
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

function roleActions(
  account: TeamAccountRow,
  changeRole: ChangeRole | undefined,
  run: RunChange,
): TeamAction[] {
  if (changeRole === undefined || !account.active) return [];
  return [
    {
      label: roleActionLabel(account.role),
      onSelect: ({ id }) => {
        run(id, () =>
          changeRole(id, account.role === 'manager' ? 'dev' : 'manager'),
        );
      },
    },
  ];
}

export function TeamPage({
  loadTeam,
  actionsFor,
  changeRole,
  changeActive,
  createResetLink,
  now: fixedNow,
  invitationActions,
  origin = window.location.origin,
  copy = writeClipboard,
}: TeamPageProps): ReactElement {
  const { view, busy, message, run, reload } = useTeamChanges(loadTeam);
  const resets = useTeamResetRows({
    createResetLink,
    origin,
    copy,
    run,
    accounts: view?.status === 'ok' ? view.accounts : undefined,
  });
  const status = useStatusActions(changeActive, run);
  const now = useNow(fixedNow);
  const invites = useInvitations(invitationActions, reload);
  function rowActions(account: TeamAccountRow): readonly TeamAction[] {
    return status.actionsFor(account, [
      ...roleActions(account, changeRole, run),
      ...resets.actionsOf(account),
      ...(actionsFor?.(account) ?? []),
    ]);
  }
  return (
    <div className="fd-team-page">
      <PageHeader
        title="Team"
        {...(view?.status === 'ok'
          ? { summary: teamSummary(view.accounts) }
          : {})}
        pending={view === undefined}
        {...inviteSlot(invitationActions, view, invites.open, invites.button)}
      />
      <TeamContent
        view={view}
        now={now}
        actionsFor={rowActions}
        busy={busy}
        message={message}
        below={resets.below}
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
      {status.dialog}
    </div>
  );
}

export function teamRoute(
  props: Omit<TeamPageProps, 'loadTeam'> & { loadTeam?: LoadTeam | undefined },
): ReactElement | undefined {
  const { loadTeam } = props;
  if (loadTeam === undefined) return undefined;
  return (
    <Route path="team" element={<TeamPage {...props} loadTeam={loadTeam} />} />
  );
}
