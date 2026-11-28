import type { GitHostKind } from './host-cli.ts';

export const CHOOSE_GIT_HOST = 'Choose GitHub or GitLab';
export const NO_SECRET_KEY = 'No secret key: set FACTORYDECK_SECRET_KEY';

const KNOWN_HOSTS: Record<string, GitHostKind> = {
  'github.com': 'github',
  'gitlab.com': 'gitlab',
};

export function hostOf(remote: string): string {
  return remote.split('/')[0] ?? '';
}

export function knownGitHost(remote: string): GitHostKind | undefined {
  return KNOWN_HOSTS[hostOf(remote)];
}
