import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

const RowSchema = z.record(z.string(), z.unknown());

export const FakeGitHostSchema = z.object({
  host: z.enum(['github', 'gitlab']),
  repository: z.string(),
  issues: z.array(RowSchema),
  requests: z.array(RowSchema),
  labels: z.array(RowSchema).optional(),
  closes: z.record(z.string(), z.array(RowSchema)).optional(),
  notes: z.record(z.string(), z.array(RowSchema)).optional(),
  reopened: z.array(z.number()).optional(),
  factory: z.string().optional(),
  fail: z.string().optional(),
  hang: z.boolean().optional(),
  log: z.string().optional(),
});

export type FakeGitHostData = z.infer<typeof FakeGitHostSchema>;

const FAKE_CLI = join(import.meta.dirname, 'fake-git-host-cli.ts');

export const FACTORY_WORKFLOW = [
  'issues:',
  '  labels:',
  '    ready: agent:ready',
  '    working: agent:working',
  '    needs_spec: agent:needs-spec',
  '    review: agent:review',
  '    blocked: agent:blocked',
  'build:',
  '  auto_merge: true',
  '',
].join('\n');

export function fakeGitHostFolder(root: string): string {
  return join(root, '.fake-git-host');
}

export async function writeFakeGitHostData(
  root: string,
  data: FakeGitHostData,
): Promise<void> {
  await writeFile(
    join(fakeGitHostFolder(root), 'data.json'),
    JSON.stringify(data),
  );
}

export async function installFakeGitHost(
  root: string,
  data: FakeGitHostData,
): Promise<string> {
  const folder = fakeGitHostFolder(root);
  await mkdir(folder, { recursive: true });
  const cli = join(folder, 'cli');
  await writeFile(
    cli,
    `#!/bin/sh\nexec "${process.execPath}" "${FAKE_CLI}" "${join(folder, 'data.json')}" "$@"\n`,
  );
  await chmod(cli, 0o755);
  await writeFakeGitHostData(root, data);
  const agents = join(root, 'docs', 'agents');
  await mkdir(agents, { recursive: true });
  await writeFile(
    join(agents, 'factory.yml'),
    `version: 2\nrepository:\n  git_host: ${data.host}\n  git_host_commands: docs/agents/git-host.md\n${data.factory ?? FACTORY_WORKFLOW}`,
  );
  const repositoryLine = data.host === 'github' ? 'Repository' : 'Project';
  await writeFile(
    join(agents, 'git-host.md'),
    `# Git host\n\n- CLI: \`${cli}\`\n- ${repositoryLine}: \`${data.repository}\`\n`,
  );
  return cli;
}
