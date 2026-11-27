import type { ReactElement } from 'react';
import { PageHeader } from './components/PageHeader.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import { useRefreshing } from './skills-api.ts';
import type { LoadTeam, TeamView } from './team-api.ts';
import { REFUSED_MESSAGE, teamSummary } from './team-view.ts';
import { type TeamActionsFor, TeamTable } from './TeamTable.tsx';
import { useNow } from './use-now.ts';
import './team.css';

export interface TeamPageProps {
  loadTeam: LoadTeam;
  actionsFor?: TeamActionsFor | undefined;
  now?: Date | undefined;
}

const LOADING = 'Loading…';

function TeamContent({
  view,
  now,
  actionsFor,
}: {
  view: TeamView | undefined;
  now: Date;
  actionsFor: TeamActionsFor | undefined;
}): ReactElement {
  if (view === undefined) return <StatusLine>{LOADING}</StatusLine>;
  if (view.status === 'refused') {
    return <StatusLine>{REFUSED_MESSAGE}</StatusLine>;
  }
  if (view.status === 'unreachable') {
    return <StatusLine>{UNREACHABLE_MESSAGE}</StatusLine>;
  }
  return (
    <TeamTable accounts={view.accounts} now={now} actionsFor={actionsFor} />
  );
}

export function TeamPage({
  loadTeam,
  actionsFor,
  now: fixedNow,
}: TeamPageProps): ReactElement {
  const view = useRefreshing('team', loadTeam, 'team');
  const now = useNow(fixedNow);
  return (
    <div className="fd-team-page">
      <PageHeader
        title="Team"
        {...(view?.status === 'ok'
          ? { summary: teamSummary(view.accounts) }
          : {})}
        pending={view === undefined}
      />
      <TeamContent view={view} now={now} actionsFor={actionsFor} />
    </div>
  );
}
