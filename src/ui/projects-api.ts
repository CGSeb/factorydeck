import type {
  ListedProject,
  NoRemote,
  PendingRemote,
  ProjectsResponse,
  TeamProject,
} from '../team/project-types.ts';
import { DATABASE_UNREACHABLE, SERVER_UNREACHABLE } from './auth-api.ts';
import { REFUSED_RETRY_SECONDS } from './team-api.ts';

export type { ListedProject, NoRemote, PendingRemote, TeamProject };

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

export type SaveProjectOutcome =
  | { status: 'saved'; project: ListedProject }
  | { status: 'invalid'; field: ProjectField; message: string }
  | { status: 'missing' }
  | { status: 'failed'; message: string };

export type SaveProject = (
  id: number,
  changes: Partial<ProjectInput>,
) => Promise<SaveProjectOutcome>;
export type RemoveProjectOutcome = 'removed' | 'not-found' | 'failed';

export type RemoveProject = (
  project: TeamProject,
) => Promise<RemoveProjectOutcome>;

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

function isListed(value: unknown): value is ListedProject {
  return (
    isProject(value) &&
    isRecord(value) &&
    typeof value['sessions'] === 'number' &&
    typeof value['tokenSet'] === 'boolean'
  );
}

function isTime(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isPendingRemote(value: unknown): value is PendingRemote {
  return (
    isRecord(value) &&
    typeof value['remote'] === 'string' &&
    typeof value['sessions'] === 'number' &&
    isTime(value['firstAt']) &&
    isTime(value['lastAt'])
  );
}

function isNoRemote(value: unknown): value is NoRemote | null {
  return (
    value === null ||
    (isRecord(value) &&
      typeof value['sessions'] === 'number' &&
      typeof value['folders'] === 'number')
  );
}

function okView(
  body: Record<string, unknown>,
  refreshSeconds: number,
): ProjectsView | undefined {
  const projects: unknown = body['projects'];
  const pendingRemotes: unknown = body['pendingRemotes'];
  const noRemote: unknown = body['noRemote'];
  if (
    body['status'] !== 'ok' ||
    !Array.isArray(projects) ||
    !projects.every(isListed) ||
    !Array.isArray(pendingRemotes) ||
    !pendingRemotes.every(isPendingRemote) ||
    !isNoRemote(noRemote)
  ) {
    return undefined;
  }
  return {
    status: 'ok',
    refreshSeconds,
    secretKey: body['secretKey'] === true,
    projects,
    pendingRemotes,
    noRemote,
  };
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

type Refusal =
  | { status: 'invalid'; field: ProjectField; message: string }
  | { status: 'failed'; message: string };

function refusalOf(status: number, body: unknown): Refusal {
  const message = errorOf(body);
  if (message !== undefined && status === 409) {
    return { status: 'invalid', field: 'remote', message };
  }
  const field = fieldOf(body);
  if (message !== undefined && status === 400 && field !== undefined) {
    return { status: 'invalid', field, message };
  }
  return { status: 'failed', message: message ?? SERVER_UNREACHABLE };
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
      return okView(body, refreshSeconds);
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
    if (response.status === 503) {
      return { status: 'failed', message: DATABASE_UNREACHABLE };
    }
    return refusalOf(response.status, body);
  };
}

export function projectSaver(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): SaveProject {
  return async (id, changes) => {
    let response: Response;
    try {
      response = await fetchImpl(`${PROJECTS_URL}/${String(id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(changes),
      });
    } catch {
      return { status: 'failed', message: SERVER_UNREACHABLE };
    }
    const body: unknown = await response.json().catch(() => undefined);
    if (response.status === 200 && isListed(body)) {
      return { status: 'saved', project: body };
    }
    if (response.status === 404) return { status: 'missing' };
    if (response.status === 503) {
      return { status: 'failed', message: DATABASE_UNREACHABLE };
    }
    return refusalOf(response.status, body);
  };
}

export function projectRemover(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): RemoveProject {
  return async (project) => {
    try {
      const response = await fetchImpl(
        `${PROJECTS_URL}/${String(project.id)}`,
        { method: 'DELETE' },
      );
      if (response.status === 204) return 'removed';
      return response.status === 404 ? 'not-found' : 'failed';
    } catch {
      return 'failed';
    }
  };
}
