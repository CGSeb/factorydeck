import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import {
  type HostCliOptions,
  type RunHostCli,
  hostCliRunner,
} from '../team/host-cli.ts';

export type FakeAnswer =
  | { status: 200; body: unknown }
  | { status: 200; text: string }
  | { status: number }
  | { hang: true }
  | { stderr: string };

const FakeCallSchema = z.object({
  cli: z.string(),
  args: z.array(z.string()),
  cwd: z.string(),
  env: z.record(z.string(), z.string()),
});

export type FakeCall = z.output<typeof FakeCallSchema>;

export interface FakeHostCli {
  folder: string;
  options: (serverEnv?: NodeJS.ProcessEnv) => HostCliOptions;
  answer: (path: string, answer: FakeAnswer) => Promise<void>;
  calls: () => Promise<FakeCall[]>;
  remove: () => Promise<void>;
}

const SCRIPT = `#!/usr/bin/env node
const { appendFileSync, readFileSync } = require('node:fs');
const { basename, dirname, join } = require('node:path');
const here = dirname(process.argv[1]);
const cli = basename(process.argv[1]);
const args = process.argv.slice(2);
appendFileSync(join(here, 'calls.log'), JSON.stringify({ cli, args, cwd: process.cwd(), env: process.env }) + '\\n');
const answers = JSON.parse(readFileSync(join(here, 'answers.json'), 'utf8'));
const answer = answers[args.at(-1)] ?? { status: 404 };
const reasons = { 401: 'Bad credentials', 403: 'Forbidden', 404: 'Not Found', 429: 'Too Many Requests', 500: 'Server Error', 502: 'Bad Gateway' };
if (answer.hang) setTimeout(() => undefined, 60000);
else if (answer.stderr !== undefined) { process.stderr.write(answer.stderr + '\\n'); process.exit(1); }
else if (answer.status === 200 && answer.text !== undefined) process.stdout.write(answer.text);
else if (answer.status === 200) process.stdout.write(JSON.stringify(answer.body));
else {
  const reason = reasons[answer.status] ?? 'Error';
  process.stderr.write(cli === 'gh' ? 'gh: ' + reason + ' (HTTP ' + answer.status + ')\\n' : 'glab: ' + answer.status + ' ' + reason + ' (HTTP ' + answer.status + ')\\n');
  process.exit(1);
}
`;

export async function fakeHostCli(): Promise<FakeHostCli> {
  const folder = await mkdtemp(join(tmpdir(), 'factorydeck-fake-cli-'));
  const answers: Record<string, FakeAnswer> = {};
  for (const cli of ['gh', 'glab']) {
    const path = join(folder, cli);
    await writeFile(path, SCRIPT);
    await chmod(path, 0o755);
  }
  await writeFile(join(folder, 'answers.json'), '{}');
  return {
    folder,
    options: (serverEnv = process.env) => ({
      commands: { github: join(folder, 'gh'), gitlab: join(folder, 'glab') },
      serverEnv,
      timeoutMs: 2000,
    }),
    answer: async (path, answer) => {
      answers[path] = answer;
      await writeFile(join(folder, 'answers.json'), JSON.stringify(answers));
    },
    calls: async () => {
      const text = await readFile(join(folder, 'calls.log'), 'utf8').catch(
        () => '',
      );
      return text
        .split('\n')
        .filter((line) => line !== '')
        .map((line) => FakeCallSchema.parse(JSON.parse(line)));
    },
    remove: () => rm(folder, { recursive: true, force: true }),
  };
}

export function fakeRunner(
  fake: FakeHostCli,
  serverEnv?: NodeJS.ProcessEnv,
): RunHostCli {
  return hostCliRunner(fake.options(serverEnv));
}
