import { defineConfig } from 'drizzle-kit';
import { loadRootEnvFile, validateEnv } from './src/config/env.ts';

loadRootEnvFile();

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    /** Validated on read: tools that only load this file (`generate`) do not need a database. */
    get url(): string {
      return validateEnv(process.env).DATABASE_URL;
    },
  },
});
