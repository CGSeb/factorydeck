import type { TeamAccountRow } from '../team/types.ts';
import type { LoadTeam, TeamView } from './team-api.ts';

export const TEAM_NOW = new Date('2026-03-12T15:30:00Z');

function minutesAgo(minutes: number): string {
  return new Date(TEAM_NOW.getTime() - minutes * 60_000).toISOString();
}

export const aloneManager: TeamAccountRow[] = [
  {
    id: 1,
    name: 'Ada',
    email: 'ada@example.test',
    role: 'manager',
    active: true,
    lastSignInAt: minutesAgo(0),
    you: true,
  },
];

export const someTeam: TeamAccountRow[] = [
  ...aloneManager,
  {
    id: 4,
    name: 'Bruno Delacroix-Montgomery the Second',
    email:
      'bruno.delacroix-montgomery.the.second@long-company-name.example.test',
    role: 'dev',
    active: true,
    lastSignInAt: minutesAgo(3),
    you: false,
  },
  {
    id: 2,
    name: 'Chen',
    email: 'chen@example.test',
    role: 'manager',
    active: true,
    lastSignInAt: minutesAgo(5 * 24 * 60),
    you: false,
  },
  {
    id: 5,
    name: 'Dara',
    email: 'dara@example.test',
    role: 'dev',
    active: true,
    lastSignInAt: null,
    you: false,
  },
  {
    id: 3,
    name: 'Eve',
    email: 'eve@example.test',
    role: 'dev',
    active: false,
    lastSignInAt: minutesAgo(2 * 60),
    you: false,
  },
];

export function teamResponse(accounts: TeamAccountRow[]): TeamView {
  return { status: 'ok', refreshSeconds: 3600, accounts };
}

export function teamLoaderOf(view: TeamView | undefined): LoadTeam {
  return () => Promise.resolve(view);
}

export function pendingTeam(): LoadTeam {
  return () => new Promise<undefined>(() => undefined);
}

export function teamSequence(views: readonly TeamView[]): LoadTeam {
  let call = 0;
  return () => {
    const view = views[Math.min(call, views.length - 1)];
    call += 1;
    return Promise.resolve(view);
  };
}
