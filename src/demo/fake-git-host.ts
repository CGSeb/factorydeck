import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { chmod, mkdir, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
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
  stateEvents: z
    .record(
      z.string(),
      z.array(
        z.object({ state: z.enum(['closed', 'reopened']), at: z.string() }),
      ),
    )
    .optional(),
  labelEvents: z.record(z.string(), z.array(RowSchema)).optional(),
  factory: z.string().optional(),
  defaultBranch: z.string().optional(),
  remoteFactory: z.string().optional(),
  fail: z.string().optional(),
  hang: z.boolean().optional(),
  log: z.string().optional(),
});

export type FakeGitHostData = z.infer<typeof FakeGitHostSchema>;

export function reopenedOnce(
  numbers: readonly number[],
  closedAt: string,
  reopenedAt: string,
): NonNullable<FakeGitHostData['stateEvents']> {
  return Object.fromEntries(
    numbers.map((number) => [
      String(number),
      [
        { state: 'closed' as const, at: closedAt },
        { state: 'reopened' as const, at: reopenedAt },
      ],
    ]),
  );
}

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

export function fakeGitHostToken(root: string): string {
  return join(fakeGitHostFolder(root), 'data.json');
}

async function writeExecutable(path: string, text: string): Promise<void> {
  const temporary = `${path}.${randomUUID()}`;
  await writeFile(temporary, text);
  await chmod(temporary, 0o755);
  await rename(temporary, path);
}

let commands: Promise<Record<FakeGitHostData['host'], string>> | undefined;

export function fakeGitHostCommands(): Promise<
  Record<FakeGitHostData['host'], string>
> {
  commands ??= writeFakeGitHostCommands();
  return commands;
}

async function writeFakeGitHostCommands(): Promise<
  Record<FakeGitHostData['host'], string>
> {
  const hash = createHash('sha256')
    .update(`${process.execPath}\n${FAKE_CLI}`)
    .digest('hex')
    .slice(0, 16);
  const folder = join(tmpdir(), `factorydeck-fake-git-host-${hash}`);
  await mkdir(folder, { recursive: true });
  const script = `#!/bin/sh\nexec "${process.execPath}" "${FAKE_CLI}" "$@"\n`;
  const commands = { github: join(folder, 'gh'), gitlab: join(folder, 'glab') };
  await writeExecutable(commands.github, script);
  await writeExecutable(commands.gitlab, script);
  return commands;
}

export async function installFakeGitHost(
  root: string,
  data: FakeGitHostData,
): Promise<void> {
  await mkdir(fakeGitHostFolder(root), { recursive: true });
  await writeFakeGitHostData(root, data);
  const agents = join(root, 'docs', 'agents');
  await mkdir(agents, { recursive: true });
  await writeFile(
    join(agents, 'factory.yml'),
    `version: 2\nrepository:\n  git_host: ${data.host}\n${data.factory ?? FACTORY_WORKFLOW}`,
  );
}

const FACTORY_PATH = 'docs/agents/factory.yml';

export type FakeFactoryAnswer = { status: 200; text: string } | { status: 404 };

function factoryText(data: FakeGitHostData, root: string): FakeFactoryAnswer {
  if (data.remoteFactory !== undefined) {
    return { status: 200, text: data.remoteFactory };
  }
  try {
    return {
      status: 200,
      text: readFileSync(join(root, FACTORY_PATH), 'utf8'),
    };
  } catch {
    return { status: 404 };
  }
}

export function fakeFactoryAnswer(
  data: FakeGitHostData,
  root: string,
  args: readonly string[],
): FakeFactoryAnswer | undefined {
  const plain = args.filter(
    (arg, index) => arg !== '--hostname' && args[index - 1] !== '--hostname',
  );
  if (plain[0] !== 'api') return undefined;
  const endpoint = new URL(plain.at(-1) ?? '', 'https://host.invalid/');
  const path = decodeURIComponent(endpoint.pathname).toLowerCase();
  const branch = data.defaultBranch ?? 'main';
  const repository =
    data.host === 'github'
      ? `/repos/${data.repository.toLowerCase()}`
      : `/projects/${data.repository.toLowerCase()}`;
  if (path === repository) {
    return { status: 200, text: JSON.stringify({ default_branch: branch }) };
  }
  const file =
    data.host === 'github'
      ? `${repository}/contents/${FACTORY_PATH}`
      : `${repository}/repository/files/${FACTORY_PATH}/raw`;
  if (path !== file) return undefined;
  if (endpoint.searchParams.get('ref') !== branch) return { status: 404 };
  return factoryText(data, root);
}
