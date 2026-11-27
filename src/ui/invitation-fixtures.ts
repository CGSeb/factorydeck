import type {
  CreatedInvitation,
  TeamAccountRow,
  TeamInvitation,
} from '../team/types.ts';
import type {
  AcceptInvitation,
  AcceptOutcome,
  InvitationActions,
  InvitationRead,
  ReadInvitation,
} from './invitations-api.ts';
import type { TeamView } from './team-api.ts';
import { TEAM_NOW } from './team-fixtures.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

function at(offsetMs: number): string {
  return new Date(TEAM_NOW.getTime() + offsetMs).toISOString();
}

export const STORY_ORIGIN = 'https://deck.example.test';
export const STORY_TOKEN = 'k3Jx9QvT2mN8pL4rS6wY1zA5bC7dE0fG-hI_uVoXq2s';

export const pendingInvitations: TeamInvitation[] = [
  {
    id: 11,
    email: 'fay@example.test',
    role: 'dev',
    invitedBy: 'Ada',
    createdAt: at(-6 * DAY_MS),
    expiresAt: at(DAY_MS),
  },
  {
    id: 12,
    email: 'gus.with-a-very-long-address@long-company-name.example.test',
    role: 'manager',
    invitedBy: null,
    createdAt: at(-2 * DAY_MS),
    expiresAt: at(5 * DAY_MS),
  },
  {
    id: 13,
    email: 'hal@example.test',
    role: 'dev',
    invitedBy: 'Chen',
    createdAt: at(0),
    expiresAt: at(7 * DAY_MS),
  },
];

const HAL: TeamInvitation = {
  id: 13,
  email: 'hal@example.test',
  role: 'dev',
  invitedBy: 'Chen',
  createdAt: at(0),
  expiresAt: at(7 * DAY_MS),
};

export function createdInvitation(
  invitation: TeamInvitation = HAL,
): CreatedInvitation {
  return { ...invitation, token: STORY_TOKEN };
}

export function storyActions(
  overrides: Partial<InvitationActions> = {},
): InvitationActions {
  return {
    invite: (input) =>
      Promise.resolve({
        status: 'created',
        invitation: { ...createdInvitation(), ...input },
      }),
    newLink: (id) =>
      Promise.resolve({
        status: 'created',
        invitation: {
          ...createdInvitation(pendingInvitations.find((row) => row.id === id)),
          id: id + 100,
        },
      }),
    revoke: () => Promise.resolve({ status: 'revoked' }),
    ...overrides,
  };
}

export function readerOf(read: InvitationRead): ReadInvitation {
  return () => Promise.resolve(read);
}

export function readerSequence(
  reads: readonly InvitationRead[],
): ReadInvitation {
  let call = 0;
  return () => {
    const read = reads[Math.min(call, reads.length - 1)];
    call += 1;
    return Promise.resolve(read ?? { status: 'dead' });
  };
}

export function pendingReader(): ReadInvitation {
  return () => new Promise<InvitationRead>(() => undefined);
}

export const PENDING_READ: InvitationRead = {
  status: 'pending',
  email: 'hal@example.test',
  role: 'dev',
};

export function accepterOf(outcome: AcceptOutcome): AcceptInvitation {
  return () => Promise.resolve(outcome);
}

export function pendingAccepter(): AcceptInvitation {
  return () => new Promise<AcceptOutcome>(() => undefined);
}

export const NEW_ACCOUNT = {
  id: 9,
  email: 'hal@example.test',
  name: 'Hal',
  role: 'dev',
} as const;

export function teamWithInvitations(
  accounts: TeamAccountRow[],
  invitations: TeamInvitation[] = pendingInvitations,
): TeamView {
  return { status: 'ok', refreshSeconds: 3600, accounts, invitations };
}
