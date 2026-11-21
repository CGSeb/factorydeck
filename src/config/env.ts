import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  FACTORYDECK_PORT: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().int().min(1).max(65_535).default(4317),
  ),
  FACTORYDECK_INGEST_INTERVAL_SECONDS: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().int().min(1).default(10),
  ),
  FACTORYDECK_INACTIVE_AFTER_MINUTES: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().int().min(1).default(30),
  ),
  FACTORYDECK_COLLECT_INTERVAL_MINUTES: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().int().min(1).default(5),
  ),
  CLAUDE_PROJECTS_DIR: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.string().trim().min(1).optional(),
  ),
  FACTORYDECK_CONFIG: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.string().trim().min(1).optional(),
  ),
});

export type Env = z.output<typeof EnvSchema>;

/** Parses the environment, failing with every invalid variable listed. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

const ROOT = join(import.meta.dirname, '..', '..');

/** The repository root `.env`, shared with Docker Compose. */
export const ROOT_ENV_FILE = join(ROOT, '.env');

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
  return expandHome(configured);
}

export function expandHome(path: string): string {
  if (path === '~' || path.startsWith('~/')) {
    return join(homedir(), path.slice(1));
  }
  return path;
}

export function workflowConfigPath(
  env: Pick<Env, 'FACTORYDECK_CONFIG'>,
): string {
  const configured = env.FACTORYDECK_CONFIG;
  if (configured === undefined) return join(ROOT, 'factorydeck.yml');
  return resolve(ROOT, expandHome(configured));
}
