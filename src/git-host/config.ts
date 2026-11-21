import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseDocument } from 'yaml';
import { expandHome } from '../config/env.ts';
import { FACTORY_FILE, factoryFile } from '../ingest/factory.ts';
import { GIT_HOSTS, type GitHostName } from './types.ts';

export interface GitHostConfig {
  gitHost: GitHostName;
  cli: string;
  repository: string;
}

export class GitHostConfigError extends Error {
  readonly gitHost: GitHostName | null;

  constructor(message: string, gitHost: GitHostName | null = null) {
    super(message);
    this.gitHost = gitHost;
  }
}

const DEFAULT_CLI: Record<GitHostName, string> = {
  github: 'gh',
  gitlab: 'glab',
};

const REPOSITORY_LINE: Record<GitHostName, string> = {
  github: 'Repository',
  gitlab: 'Project',
};

const REPOSITORY_SHAPE: Record<GitHostName, RegExp> = {
  github: /^[\w.-]+\/[\w.-]+$/,
  gitlab: /^[\w.-]+(\/[\w.-]+)+$/,
};

const REPOSITORY_EXAMPLE: Record<GitHostName, string> = {
  github: '<owner>/<name>',
  gitlab: '<group>/<project>',
};

function isGitHost(value: string): value is GitHostName {
  return GIT_HOSTS.some((host) => host === value);
}

async function readText(
  path: string,
  shown: string,
  gitHost: GitHostName | null,
): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    throw new GitHostConfigError(`${shown} not found`, gitHost);
  }
}

function stringAt(
  document: ReturnType<typeof parseDocument>,
  path: string[],
): string | undefined {
  const value: unknown = document.getIn(path);
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  return value.trim();
}

export function lineValue(text: string, label: string): string | undefined {
  const pattern = new RegExp(`^\\s*[-*]\\s+${label}:\\s*\`([^\`]*)\``, 'i');
  for (const line of text.split(/\r?\n/)) {
    const value = pattern.exec(line)?.[1]?.trim();
    if (value !== undefined && value !== '') return value;
  }
  return undefined;
}

async function factorySettings(
  root: string,
): Promise<{ gitHost: GitHostName; commandsPath: string }> {
  const document = parseDocument(
    await readText(factoryFile(root), FACTORY_FILE, null),
  );
  if (document.errors.length > 0) {
    throw new GitHostConfigError(`${FACTORY_FILE} is not valid YAML`);
  }
  const hostValue = stringAt(document, ['repository', 'git_host']);
  if (hostValue === undefined) {
    throw new GitHostConfigError(`${FACTORY_FILE} has no repository.git_host`);
  }
  const gitHost = hostValue.toLowerCase();
  if (!isGitHost(gitHost)) {
    throw new GitHostConfigError(
      `repository.git_host is ${hostValue}, not github or gitlab`,
    );
  }
  const commandsPath = stringAt(document, ['repository', 'git_host_commands']);
  if (commandsPath === undefined) {
    throw new GitHostConfigError(
      `${FACTORY_FILE} has no repository.git_host_commands`,
      gitHost,
    );
  }
  return { gitHost, commandsPath };
}

function repositoryOf(
  commands: string,
  gitHost: GitHostName,
  commandsPath: string,
): string {
  const label = REPOSITORY_LINE[gitHost];
  const repository = lineValue(commands, label);
  if (repository === undefined) {
    throw new GitHostConfigError(
      `${commandsPath} has no "- ${label}: \`${REPOSITORY_EXAMPLE[gitHost]}\`" line`,
      gitHost,
    );
  }
  if (!REPOSITORY_SHAPE[gitHost].test(repository)) {
    throw new GitHostConfigError(
      `${label} ${repository} in ${commandsPath} is not ${REPOSITORY_EXAMPLE[gitHost]}`,
      gitHost,
    );
  }
  return repository;
}

export async function readGitHostConfig(root: string): Promise<GitHostConfig> {
  const { gitHost, commandsPath } = await factorySettings(root);
  const commands = await readText(
    resolve(root, expandHome(commandsPath)),
    commandsPath,
    gitHost,
  );
  return {
    gitHost,
    cli: cliPath(root, lineValue(commands, 'CLI')) ?? DEFAULT_CLI[gitHost],
    repository: repositoryOf(commands, gitHost, commandsPath),
  };
}

function cliPath(root: string, cli: string | undefined): string | undefined {
  if (cli === undefined) return undefined;
  const expanded = expandHome(cli);
  return expanded.includes('/') ? resolve(root, expanded) : expanded;
}
