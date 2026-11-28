import type { ProjectsResponse, TeamProject } from '../team/project-types.ts';
import { DATABASE_UNREACHABLE, SERVER_UNREACHABLE } from './auth-api.ts';
import { REFUSED_RETRY_SECONDS } from './team-api.ts';

export type { TeamProject };

export const PROJECTS_URL = '/api/admin/projects';

export type ProjectsView =
  ProjectsResponse | { status: 'refused'; refreshSeconds: number };

export type LoadProjects = () => Promise<ProjectsView | undefined>;

export interface ProjectInput {
  remote: string;
  name: string;
}

export type ProjectField = 'remote' | 'name';

export type AddProjectOutcome =
  | { status: 'added'; project: TeamProject }
  | { status: 'invalid'; field: ProjectField; message: string }
  | { status: 'failed'; message: string };

export type AddProject = (input: ProjectInput) => Promise<AddProjectOutcome>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProject(value: unknown): value is TeamProject {
  return (
    isRecord(value) &&
    typeof value['id'] === 'number' &&
    typeof value['name'] === 'string' &&
    typeof value['slug'] === 'string' &&
    typeof value['remote'] === 'string' &&
    typeof value['createdAt'] === 'string'
  );
}

function errorOf(body: unknown): string | undefined {
  if (!isRecord(body)) return undefined;
  const error = body['error'];
  return typeof error === 'string' && error !== '' ? error : undefined;
}

function fieldOf(body: unknown): ProjectField | undefined {
  const field = isRecord(body) ? body['field'] : undefined;
  return field === 'remote' || field === 'name' ? field : undefined;
}

export function projectsLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): LoadProjects {
  return async () => {
    try {
      const response = await fetchImpl(PROJECTS_URL);
      if (response.status === 403) {
        return { status: 'refused', refreshSeconds: REFUSED_RETRY_SECONDS };
      }
      if (response.status !== 200 && response.status !== 503) return undefined;
      const body: unknown = await response.json();
      if (!isRecord(body) || typeof body['refreshSeconds'] !== 'number') {
        return undefined;
      }
      const refreshSeconds = body['refreshSeconds'];
      if (body['status'] === 'unreachable') {
        return { status: 'unreachable', refreshSeconds };
      }
      const projects: unknown = body['projects'];
      if (
        body['status'] !== 'ok' ||
        !Array.isArray(projects) ||
        !projects.every(isProject)
      ) {
        return undefined;
      }
      return { status: 'ok', refreshSeconds, projects };
    } catch {
      return undefined;
    }
  };
}

export function projectAdder(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): AddProject {
  return async (input) => {
    let response: Response;
    try {
      response = await fetchImpl(PROJECTS_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
    } catch {
      return { status: 'failed', message: SERVER_UNREACHABLE };
    }
    const body: unknown = await response.json().catch(() => undefined);
    if (response.status === 201 && isProject(body)) {
      return { status: 'added', project: body };
    }
    const message = errorOf(body);
    if (response.status === 503) {
      return { status: 'failed', message: DATABASE_UNREACHABLE };
    }
    if (message !== undefined && response.status === 409) {
      return { status: 'invalid', field: 'remote', message };
    }
    const field = fieldOf(body);
    if (
      message !== undefined &&
      response.status === 400 &&
      field !== undefined
    ) {
      return { status: 'invalid', field, message };
    }
    return { status: 'failed', message: message ?? SERVER_UNREACHABLE };
  };
}
