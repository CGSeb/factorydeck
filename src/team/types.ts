import type { Role } from '../auth/types.ts';

export interface TeamAccount {
  id: number;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  lastSignInAt: string | null;
}

export interface TeamAccountRow extends TeamAccount {
  you: boolean;
}

export type TeamResponse =
  | { status: 'ok'; refreshSeconds: number; accounts: TeamAccountRow[] }
  | { status: 'unreachable'; refreshSeconds: number };

export const MANAGERS_ONLY = 'Managers only';
