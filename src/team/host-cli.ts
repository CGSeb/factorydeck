import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type GitHostKind = 'github' | 'gitlab';

export const HOST_CLI_TIMEOUT_MS = 30_000;

export type HostCliFailure =
  'missing' | 'unauthorized' | 'forbidden' | 'not-found' | 'unreachable';

export type HostCliResult =
  { ok: true; value: unknown } | { ok: false; failure: HostCliFailure };

export interface HostCliCall {
  gitHost: GitHostKind;
  host: string;
  token: string;
  args: string[];
}

export type RunHostCli = (call: HostCliCall) => Promise<HostCliResult>;

export interface HostCliOptions {
  commands?: Partial<Record<GitHostKind, string>>;
  timeoutMs?: number;
  serverEnv?: NodeJS.ProcessEnv;
}

export const CLI_OF: Record<GitHostKind, string> = {
  github: 'gh',
  gitlab: 'glab',
};

const INHERITED = [
  'PATH',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'ALL_PROXY',
  'http_proxy',
  'https_proxy',
  'no_proxy',
  'all_proxy',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
  'NODE_EXTRA_CA_CERTS',
];

function inherited(serverEnv: NodeJS.ProcessEnv): Record<string, string> {
  const env: Record<string, string> = {};
  for (const name of INHERITED) {
    const value = serverEnv[name];
    if (value !== undefined) env[name] = value;
  }
  return env;
}

function tokenEnv(
  { gitHost, host, token }: HostCliCall,
  configDir: string,
): Record<string, string> {
  if (gitHost === 'github') {
    return {
      GH_TOKEN: token,
      GH_ENTERPRISE_TOKEN: token,
      ...(host === 'github.com' ? {} : { GH_HOST: host }),
      GH_CONFIG_DIR: configDir,
    };
  }
  return {
    GITLAB_TOKEN: token,
    GITLAB_HOST: host,
    GLAB_CONFIG_DIR: configDir,
  };
}

interface ExecError extends Error {
  code?: string | number | null;
  killed?: boolean;
  signal?: string | null;
}

function httpStatus(output: string): number | undefined {
  const match =
    /HTTP (\d{3})/.exec(output) ??
    /\b(\d{3}) (?:Unauthorized|Forbidden|Not Found|Too Many Requests)\b/i.exec(
      output,
    );
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

export function failureOf(error: ExecError, stderr: string): HostCliFailure {
  if (error.code === 'ENOENT') return 'missing';
  if (error.killed === true || error.signal != null) return 'unreachable';
  const status = httpStatus(stderr);
  if (status === 401) return 'unauthorized';
  if (status === 403 || status === 429) return 'forbidden';
  if (status === 404) return 'not-found';
  return 'unreachable';
}

interface Execution {
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd: string;
  timeoutMs: number;
}

function run({
  command,
  args,
  env,
  cwd,
  timeoutMs,
}: Execution): Promise<HostCliResult> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      { cwd, env, timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error !== null) {
          resolve({ ok: false, failure: failureOf(error, String(stderr)) });
          return;
        }
        try {
          resolve({ ok: true, value: JSON.parse(String(stdout)) as unknown });
        } catch {
          resolve({ ok: false, failure: 'unreachable' });
        }
      },
    );
  });
}

export function hostCliRunner({
  commands = {},
  timeoutMs = HOST_CLI_TIMEOUT_MS,
  serverEnv = process.env,
}: HostCliOptions = {}): RunHostCli {
  return async (call) => {
    const folder = await mkdtemp(join(tmpdir(), 'factorydeck-host-cli-'));
    try {
      const configDir = join(folder, 'config');
      const workDir = join(folder, 'work');
      await Promise.all([mkdir(configDir), mkdir(workDir)]);
      const env = {
        ...inherited(serverEnv),
        ...tokenEnv(call, configDir),
        GH_PROMPT_DISABLED: '1',
        NO_COLOR: '1',
      };
      return await run({
        command: commands[call.gitHost] ?? CLI_OF[call.gitHost],
        args: call.args,
        env,
        cwd: workDir,
        timeoutMs,
      });
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  };
}
