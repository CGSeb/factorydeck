import {
  CLI_OF,
  type GitHostKind,
  type HostCliFailure,
  type RunHostCli,
} from './host-cli.ts';

export const FACTORY_FILE = 'docs/agents/factory.yml';
export const BAD_TOKEN = 'Bad token';
export const CANNOT_READ = 'Token cannot read this repository';
export const REPOSITORY_NOT_FOUND =
  'Repository not found or not visible with this token';
export const REPOSITORY_EMPTY = 'Repository is empty';

export function noFactoryFile(branch: string): string {
  return `No ${FACTORY_FILE} on ${branch}`;
}

export function unreachableHost(host: string): string {
  return `Could not reach ${host}`;
}

export function cliMissing(cli: string): string {
  return `${cli} not found on the server`;
}

export interface TokenTarget {
  gitHost: GitHostKind;
  host: string;
  path: string;
}

export type TokenCheck =
  | { status: 'ok'; defaultBranch: string }
  | { status: 'cli-missing'; error: string }
  | { status: 'refused'; error: string };

export interface Endpoints {
  repository: string;
  factoryFile: (branch: string) => string;
  rawFactoryFile: (branch: string) => string[];
}

export function endpoints({
  gitHost,
  path,
}: TokenTarget): Endpoints | undefined {
  if (gitHost === 'gitlab') {
    const project = `projects/${encodeURIComponent(path)}`;
    const file = `${project}/repository/files/${encodeURIComponent(FACTORY_FILE)}`;
    return {
      repository: project,
      factoryFile: (branch) => `${file}?ref=${encodeURIComponent(branch)}`,
      rawFactoryFile: (branch) => [
        `${file}/raw?ref=${encodeURIComponent(branch)}`,
      ],
    };
  }
  const segments = path.split('/');
  if (segments.length !== 2) return undefined;
  const repository = `repos/${segments.join('/')}`;
  const file = `${repository}/contents/${FACTORY_FILE}`;
  return {
    repository,
    factoryFile: (branch) => `${file}?ref=${encodeURIComponent(branch)}`,
    rawFactoryFile: (branch) => [
      '-H',
      'Accept: application/vnd.github.raw',
      `${file}?ref=${encodeURIComponent(branch)}`,
    ],
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function failureText(
  target: TokenTarget,
  failure: HostCliFailure,
  notFound: string,
): string {
  return {
    missing: cliMissing(CLI_OF[target.gitHost]),
    unauthorized: BAD_TOKEN,
    forbidden: CANNOT_READ,
    'not-found': notFound,
    unreachable: unreachableHost(target.host),
  }[failure];
}

function refusal(
  target: TokenTarget,
  failure: HostCliFailure,
  notFound: string,
): TokenCheck {
  const error = failureText(target, failure, notFound);
  return failure === 'missing'
    ? { status: 'cli-missing', error }
    : { status: 'refused', error };
}

function isFactoryFile(target: TokenTarget, value: unknown): boolean {
  if (!isRecord(value)) return false;
  return target.gitHost === 'github'
    ? value['type'] === 'file'
    : typeof value['file_name'] === 'string';
}

export function defaultBranchOf(
  target: TokenTarget,
  repository: unknown,
): { branch: string } | { error: string } {
  const branch = isRecord(repository)
    ? repository['default_branch']
    : undefined;
  if (typeof branch === 'string' && branch !== '') return { branch };
  return {
    error: isRecord(repository)
      ? REPOSITORY_EMPTY
      : unreachableHost(target.host),
  };
}

export async function checkToken(
  run: RunHostCli,
  target: TokenTarget,
  token: string,
): Promise<TokenCheck> {
  const urls = endpoints(target);
  if (urls === undefined) {
    return { status: 'refused', error: REPOSITORY_NOT_FOUND };
  }
  const call = (path: string) =>
    run({
      gitHost: target.gitHost,
      host: target.host,
      token,
      args: ['api', '--hostname', target.host, path],
    });
  const repository = await call(urls.repository);
  if (!repository.ok) {
    return refusal(target, repository.failure, REPOSITORY_NOT_FOUND);
  }
  const found = defaultBranchOf(target, repository.value);
  if ('error' in found) return { status: 'refused', error: found.error };
  const { branch } = found;
  const file = await call(urls.factoryFile(branch));
  if (!file.ok) return refusal(target, file.failure, noFactoryFile(branch));
  if (!isFactoryFile(target, file.value)) {
    return { status: 'refused', error: noFactoryFile(branch) };
  }
  return { status: 'ok', defaultBranch: branch };
}
