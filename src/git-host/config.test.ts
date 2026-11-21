import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { GitHostConfigError, lineValue, readGitHostConfig } from './config.ts';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'factorydeck-git-host-'));
  await mkdir(join(root, 'docs', 'agents'), { recursive: true });
});

async function factory(text: string): Promise<void> {
  await writeFile(join(root, 'docs', 'agents', 'factory.yml'), text);
}

async function commands(
  text: string,
  path = 'docs/agents/git-host.md',
): Promise<void> {
  await writeFile(join(root, path), text);
}

const GITHUB = `version: 2
repository:
  git_host: github
  git_host_commands: docs/agents/git-host.md
`;

const GITLAB = `version: 2
repository:
  git_host: gitlab
  git_host_commands: docs/agents/git-host.md
`;

async function failure(): Promise<GitHostConfigError> {
  const error: unknown = await readGitHostConfig(root).then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  if (!(error instanceof GitHostConfigError))
    throw new Error('Expected a failure');
  return error;
}

describe('readGitHostConfig', () => {
  it('reads a GitHub file with its CLI and repository lines', async () => {
    await factory(GITHUB);
    await commands(
      '# Git host\n\n- CLI: `gh.exe` (the Windows GitHub CLI)\n- Repository: `example-org/example-app`\n',
    );
    await expect(readGitHostConfig(root)).resolves.toEqual({
      gitHost: 'github',
      cli: 'gh.exe',
      repository: 'example-org/example-app',
    });
  });

  it('reads a GitLab file with a nested group', async () => {
    await factory(GITLAB);
    await commands(
      '- CLI: `glab`\n- Project: `example-group/team/example-api`\n',
    );
    await expect(readGitHostConfig(root)).resolves.toEqual({
      gitHost: 'gitlab',
      cli: 'glab',
      repository: 'example-group/team/example-api',
    });
  });

  it('defaults the CLI to gh or glab without a CLI line, or with an empty one', async () => {
    await factory(GITHUB);
    await commands('- Repository: `example-org/example-app`\n');
    await expect(readGitHostConfig(root)).resolves.toMatchObject({ cli: 'gh' });
    await factory(GITLAB);
    await commands('- CLI: ``\n- Project: `example-group/example-api`\n');
    await expect(readGitHostConfig(root)).resolves.toMatchObject({
      cli: 'glab',
    });
  });

  it('accepts the git host in any case and the first of duplicate lines', async () => {
    await factory(GITHUB.replace('github', 'GitHub'));
    await commands(
      '* Repository: `example-org/first`\n- Repository: `example-org/second`\n',
    );
    await expect(readGitHostConfig(root)).resolves.toMatchObject({
      gitHost: 'github',
      repository: 'example-org/first',
    });
  });

  it('resolves the commands file and a CLI path from the project root, and ~ from home', async () => {
    await factory(GITHUB.replace('docs/agents/git-host.md', './host.md'));
    await commands(
      '- CLI: `./bin/gh`\n- Repository: `example-org/example-app`\n',
      'host.md',
    );
    await expect(readGitHostConfig(root)).resolves.toMatchObject({
      cli: join(root, 'bin', 'gh'),
    });
    await commands(
      '- CLI: `~/bin/gh`\n- Repository: `example-org/example-app`\n',
      'host.md',
    );
    await expect(readGitHostConfig(root)).resolves.toMatchObject({
      cli: join(homedir(), 'bin', 'gh'),
    });
  });

  it('names each missing key or line', async () => {
    await factory('version: 2\n');
    await expect(failure()).resolves.toMatchObject({
      message: 'docs/agents/factory.yml has no repository.git_host',
      gitHost: null,
    });
    await factory('version: 2\nrepository:\n  git_host: bitbucket\n');
    await expect(failure()).resolves.toMatchObject({
      message: 'repository.git_host is bitbucket, not github or gitlab',
    });
    await factory(
      'version: 2\nrepository:\n  git_host: github\n  git_host_commands: ""\n',
    );
    await expect(failure()).resolves.toMatchObject({
      message: 'docs/agents/factory.yml has no repository.git_host_commands',
      gitHost: 'github',
    });
    await factory(GITHUB);
    await expect(failure()).resolves.toMatchObject({
      message: 'docs/agents/git-host.md not found',
    });
    await commands('- CLI: `gh`\n');
    await expect(failure()).resolves.toMatchObject({
      message:
        'docs/agents/git-host.md has no "- Repository: `<owner>/<name>`" line',
    });
    await factory(GITLAB);
    await commands('- Repository: `example-org/example-app`\n');
    await expect(failure()).resolves.toMatchObject({
      message:
        'docs/agents/git-host.md has no "- Project: `<group>/<project>`" line',
      gitHost: 'gitlab',
    });
  });

  it('rejects a repository that is not owner/name', async () => {
    await factory(GITHUB);
    await commands(
      '- Repository: `https://github.com/example-org/example-app`\n',
    );
    await expect(failure()).resolves.toMatchObject({
      message:
        'Repository https://github.com/example-org/example-app in docs/agents/git-host.md is not <owner>/<name>',
    });
  });

  it('reports invalid YAML', async () => {
    await factory('repository: [unclosed\n');
    await expect(failure()).resolves.toMatchObject({
      message: 'docs/agents/factory.yml is not valid YAML',
    });
  });
});

describe('lineValue', () => {
  it('ignores a label inside other text', () => {
    expect(lineValue('Use the CLI: `gh` here', 'CLI')).toBeUndefined();
    expect(lineValue('  - cli: `gh`', 'CLI')).toBe('gh');
  });
});
