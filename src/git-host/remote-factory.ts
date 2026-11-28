import {
  FactorySettingsError,
  parseFactorySettings,
} from '../factory/settings.ts';
import type { GitHostKind, RunHostCli } from '../team/host-cli.ts';
import {
  FACTORY_FILE,
  REPOSITORY_NOT_FOUND,
  type TokenTarget,
  defaultBranchOf,
  endpoints,
  failureText,
  noFactoryFile,
} from '../team/token-check.ts';
import {
  type ProjectOutcomeSettings,
  outcomeSettingsOf,
} from './outcome-settings.ts';
import { GIT_HOSTS } from './types.ts';

export const MAX_FACTORY_BYTES = 1024 * 1024;
export const FACTORY_TOO_LARGE = `${FACTORY_FILE} is larger than 1 MB`;

export type RemoteFactory =
  | { ok: true; settings: ProjectOutcomeSettings }
  | { ok: false; reason: string };

export function gitHostMismatch(written: string, remote: GitHostKind): string {
  return `factory.yml says ${written}, the remote is on ${remote}`;
}

function failed(reason: string): RemoteFactory {
  return { ok: false, reason };
}

export function factorySettingsOf(
  source: string,
  gitHost: GitHostKind,
): RemoteFactory {
  if (Buffer.byteLength(source, 'utf8') > MAX_FACTORY_BYTES) {
    return failed(FACTORY_TOO_LARGE);
  }
  try {
    const settings = parseFactorySettings(source);
    const written = settings.requireText('repository.git_host');
    const lower = written.toLowerCase();
    if (!GIT_HOSTS.some((host) => host === lower)) {
      return failed(`repository.git_host is ${written}, not github or gitlab`);
    }
    if (lower !== gitHost) return failed(gitHostMismatch(written, gitHost));
    return { ok: true, settings: outcomeSettingsOf(settings) };
  } catch (error) {
    if (error instanceof FactorySettingsError) return failed(error.message);
    throw error;
  }
}

export async function readRemoteFactory(
  run: RunHostCli,
  target: TokenTarget,
  token: string,
): Promise<RemoteFactory> {
  const urls = endpoints(target);
  if (urls === undefined) return failed(REPOSITORY_NOT_FOUND);
  const call = (args: string[], raw = false) =>
    run({
      gitHost: target.gitHost,
      host: target.host,
      token,
      args: ['api', '--hostname', target.host, ...args],
      raw,
    });
  const repository = await call([urls.repository]);
  if (!repository.ok) {
    return failed(
      failureText(target, repository.failure, REPOSITORY_NOT_FOUND),
    );
  }
  const found = defaultBranchOf(target, repository.value);
  if ('error' in found) return failed(found.error);
  const file = await call(urls.rawFactoryFile(found.branch), true);
  if (!file.ok) {
    return failed(
      failureText(target, file.failure, noFactoryFile(found.branch)),
    );
  }
  if (typeof file.value !== 'string')
    return failed(noFactoryFile(found.branch));
  return factorySettingsOf(file.value, target.gitHost);
}
