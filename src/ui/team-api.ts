import type {
  InvitationsResponse,
  TeamInvitation,
  TeamResponse,
} from '../team/types.ts';
import { isResponse } from './skills-api.ts';

export const REFUSED_RETRY_SECONDS = 10;

type TeamOk = Extract<TeamResponse, { status: 'ok' }> & {
  invitations?: readonly TeamInvitation[] | undefined;
};

export type TeamView =
  | TeamOk
  | Extract<TeamResponse, { status: 'unreachable' }>
  | { status: 'refused'; refreshSeconds: number };

export type LoadTeam = () => Promise<TeamView | undefined>;

export function teamLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): LoadTeam {
  return async () => {
    try {
      const response = await fetchImpl('/api/team/accounts');
      if (response.status === 403) {
        return { status: 'refused', refreshSeconds: REFUSED_RETRY_SECONDS };
      }
      if (response.status !== 200 && response.status !== 503) return undefined;
      const body: unknown = await response.json();
      if (!isResponse<TeamResponse>(body)) return undefined;
      if (body.status === 'ok' && !Array.isArray(body.accounts)) {
        return undefined;
      }
      return body;
    } catch {
      return undefined;
    }
  };
}

export function withInvitations(
  loadTeam: LoadTeam,
  loadInvitations: () => Promise<InvitationsResponse | undefined>,
): LoadTeam {
  return async () => {
    const [team, invitations] = await Promise.all([
      loadTeam(),
      loadInvitations(),
    ]);
    if (team?.status !== 'ok') return team;
    if (invitations === undefined) return undefined;
    if (invitations.status === 'unreachable') return invitations;
    return { ...team, invitations: invitations.invitations };
  };
}
