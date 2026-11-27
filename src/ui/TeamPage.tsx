import type { ReactElement } from 'react';
import type { TeamAccountRow } from '../team/types.ts';
import { PageHeader } from './components/PageHeader.tsx';
import { StatusLine } from './components/StatusLine.tsx';
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
import { useNow } from './use-now.ts';
import './team.css';

export interface TeamPageProps {
  loadTeam: LoadTeam;
  actionsFor?: TeamActionsFor | undefined;
  changeRole?: ChangeRole | undefined;
  now?: Date | undefined;
}

const LOADING = 'Loading…';

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

export function TeamPage({
  loadTeam,
  actionsFor,
  changeRole,
  now: fixedNow,
}: TeamPageProps): ReactElement {
  const { view, busy, message, run } = useTeamChanges(loadTeam);
  const now = useNow(fixedNow);
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
      />
      <TeamContent
        view={view}
        now={now}
        actionsFor={rowActions}
        busy={busy}
        message={message}
      />
    </div>
  );
}
