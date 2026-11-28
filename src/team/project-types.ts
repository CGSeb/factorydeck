import type { FieldError } from '../auth/types.ts';

export interface TeamProject {
  id: number;
  name: string;
  slug: string;
  remote: string;
  createdAt: string;
}

export type ProjectsResponse =
  | { status: 'ok'; refreshSeconds: number; projects: TeamProject[] }
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

export const NOT_A_REMOTE = 'Not a git remote';
export const NAME_TYPE_ERROR = 'Name must be text';
export const NAME_LENGTH_ERROR = 'Name must be at most 80 characters';

export function remoteTaken(name: string): string {
  return `This remote is already the project ${name}`;
}
