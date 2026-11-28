import { knownGitHost } from '../team/git-host-kind.ts';
import type { GitHostKind, TokenState } from './git-host-token-api.ts';

export const GIT_HOST = 'Git host';
export const SAVE_TOKEN = 'Save token';
export const REMOVE_TOKEN = 'Remove token';
export const CHECKING = 'Checking…';
export const REMOVING = 'Removing…';
export const NO_TOKEN = 'No token';
export const CHOOSE = 'Choose…';
export const NO_KEY_MESSAGE =
  'Set FACTORYDECK_SECRET_KEY on the server to store tokens.';
export const LEAVE_TOKEN = 'Leave without saving the token?';
export const STOP_UPDATING = 'Its issues and pull requests stop updating.';

export const HOST_LABELS: Readonly<Record<GitHostKind, string>> = {
  github: 'GitHub',
  gitlab: 'GitLab',
};

export function readOnlyHost(remote: string): GitHostKind | undefined {
  return knownGitHost(remote);
}

export function checkedMessage(defaultBranch: string): string {
  return `Token checked: ${defaultBranch} has docs/agents/factory.yml.`;
}

export function removeQuestion(name: string): string {
  return `Remove the git host token of ${name}?`;
}

export function tokenSetBy({ tokenSetBy }: TokenState): string {
  return tokenSetBy === null ? '' : ` by ${tokenSetBy.name}`;
}

export interface GitHostRow {
  remote: string;
  gitHost?: GitHostKind | null;
  tokenSet?: boolean;
}

export function gitHostCell(row: GitHostRow): string {
  const host =
    row.gitHost === undefined ? readOnlyHost(row.remote) : row.gitHost;
  if (host === undefined || host === null) return '—';
  return `${HOST_LABELS[host]} · ${row.tokenSet === true ? 'token' : 'no token'}`;
}
