import type { FieldError } from '../auth/types.ts';
import type { GitHostKind } from './host-cli.ts';

export interface TeamProject {
  id: number;
  name: string;
  slug: string;
  remote: string;
  createdAt: string;
}

export interface ListedProject extends TeamProject {
  sessions: number;
  gitHost: GitHostKind | null;
  tokenSet: boolean;
  tokenSetAt: string | null;
  tokenSetBy: { name: string } | null;
}

export interface PendingRemote {
  remote: string;
  sessions: number;
  firstAt: string | null;
  lastAt: string | null;
}

export interface NoRemote {
  sessions: number;
  folders: number;
}

export interface RemotesNotAdded {
  pendingRemotes: PendingRemote[];
  noRemote: NoRemote | null;
}

export type ProjectsResponse =
  | ({
      status: 'ok';
      refreshSeconds: number;
      secretKey: boolean;
      projects: ListedProject[];
    } & RemotesNotAdded)
  | { status: 'unreachable'; refreshSeconds: number };

export interface NewProject {
  name: string;
  remote: string;
  slug: string;
}

export type ProjectFields =
  { ok: true; value: NewProject } | ({ ok: false } & FieldError);

export type AddProjectResult =
  | { status: 'added'; project: TeamProject }
  | { status: 'exists'; name: string };

export interface ProjectChanges {
  name?: string;
  remote?: string;
}

export type ProjectChangeFields =
  { ok: true; value: ProjectChanges } | ({ ok: false } & FieldError);

export type UpdateProjectResult =
  | { status: 'updated'; project: ListedProject }
  | { status: 'missing' }
  | { status: 'exists'; name: string };
export type RemoveProjectResult = 'removed' | 'not-found' | 'busy';

export const BUSY = 'Busy, try again';

export const NOT_A_REMOTE = 'Not a git remote';
export const NAME_TYPE_ERROR = 'Name must be text';
export const NAME_REQUIRED = 'Name is required';
export const NAME_LENGTH_ERROR = 'Name must be at most 80 characters';

export function remoteTaken(name: string): string {
  return `This remote is already the project ${name}`;
}
