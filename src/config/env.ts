import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  FACTORYDECK_PORT: z.coerce.number().int().min(1).max(65_535).default(4317),
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

/** The repository root `.env`, shared with Docker Compose. */
export const ROOT_ENV_FILE = join(import.meta.dirname, '..', '..', '.env');

/** Loads the root `.env` into `process.env` when it exists. */
export function loadRootEnvFile(): void {
  if (existsSync(ROOT_ENV_FILE)) {
    process.loadEnvFile(ROOT_ENV_FILE);
  }
}
