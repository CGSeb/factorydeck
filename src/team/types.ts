import type { Role } from '../auth/types.ts';
import type {
  CliConnectionItem,
  CliConnectionsResponse,
} from '../cli-login/connection-types.ts';

export interface TeamAccount {
  id: number;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  lastSignInAt: string | null;
  cliConnections: number;
}

export interface TeamAccountRow extends TeamAccount {
  you: boolean;
}

export type TeamResponse =
  | { status: 'ok'; refreshSeconds: number; accounts: TeamAccountRow[] }
  | { status: 'unreachable'; refreshSeconds: number };

export type TeamCliConnection = CliConnectionItem;

export type TeamCliConnectionsResponse = CliConnectionsResponse;

export const MANAGERS_ONLY = 'Managers only';

export interface TeamInvitation {
  id: number;
  email: string;
  role: Role;
  invitedBy: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface CreatedInvitation extends TeamInvitation {
  token: string;
}

export type InvitationsResponse =
  | { status: 'ok'; refreshSeconds: number; invitations: TeamInvitation[] }
  | { status: 'unreachable'; refreshSeconds: number };

export const INVITATION_NOT_FOUND = 'Invitation not found';
export const HAS_ACCOUNT = 'This email already has an account';
export const DEAD_INVITATION =
  'This invitation link no longer works. Ask a manager for a new one.';
export const ROLE_ERROR = 'Role must be manager or dev';
