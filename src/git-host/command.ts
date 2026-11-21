import { execFile } from 'node:child_process';

export const CLI_TIMEOUT_MS = 60_000;

export type RunCli = (args: string[]) => Promise<unknown>;

export function firstLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line !== '') ?? ''
  );
}

interface ExecError extends Error {
  code?: string | number | null;
  killed?: boolean;
  signal?: string | null;
}

function failure(
  { cli, timeoutMs }: { cli: string; timeoutMs: number },
  error: ExecError,
  { stdout, stderr }: { stdout: string; stderr: string },
): Error {
  if (error.code === 'ENOENT') return new Error(`${cli} not found`);
  if (error.code === 'EACCES') return new Error(`${cli} cannot be run`);
  if (error.killed === true || error.signal === 'SIGTERM') {
    return new Error(
      `${cli} did not answer within ${String(Math.round(timeoutMs / 1000))} seconds`,
    );
  }
  const message = firstLine(stderr) || firstLine(stdout);
  return new Error(
    message === ''
      ? `${cli} failed with exit code ${String(error.code)}`
      : message,
  );
}

export function cliRunner(
  cli: string,
  cwd: string,
  timeoutMs: number = CLI_TIMEOUT_MS,
): RunCli {
  return (args) =>
    new Promise((resolve, reject) => {
      execFile(
        cli,
        args,
        {
          cwd,
          timeout: timeoutMs,
          maxBuffer: 256 * 1024 * 1024,
          encoding: 'utf8',
          env: { ...process.env, GH_PROMPT_DISABLED: '1', NO_COLOR: '1' },
        },
        (error, stdout, stderr) => {
          if (error !== null) {
            reject(failure({ cli, timeoutMs }, error, { stdout, stderr }));
            return;
          }
          try {
            resolve(JSON.parse(stdout) as unknown);
          } catch {
            reject(
              new Error(`${cli} did not return JSON: ${firstLine(stdout)}`),
            );
          }
        },
      );
    });
}
