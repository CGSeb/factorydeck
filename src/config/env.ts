import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  CLAUDE_PROJECTS_DIR: z.string().trim().min(1).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

/** Parses the environment, failing with every invalid variable listed. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/** The repository root `.env`, shared with Docker Compose. */
export const ROOT_ENV_FILE = join(import.meta.dirname, '..', '..', '.env');

/** Loads the root `.env` into `process.env` when it exists. */
export function loadRootEnvFile(): void {
  if (existsSync(ROOT_ENV_FILE)) {
    process.loadEnvFile(ROOT_ENV_FILE);
  }
}

/** The folder of Claude Code session logs: `CLAUDE_PROJECTS_DIR`, else `~/.claude/projects`. */
export function sessionsFolder(env: Pick<Env, 'CLAUDE_PROJECTS_DIR'>): string {
  const configured = env.CLAUDE_PROJECTS_DIR;
  if (configured === undefined) {
    return join(homedir(), '.claude', 'projects');
  }
  if (configured === '~' || configured.startsWith('~/')) {
    return join(homedir(), configured.slice(1));
  }
  return configured;
}
