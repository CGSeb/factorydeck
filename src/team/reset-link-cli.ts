import { loadRootEnvFile, validateEnv } from '../config/env.ts';
import { createDatabase } from '../db/client.ts';
import { databaseCheck } from '../server/health.ts';
import { runResetLink } from './reset-link-command.ts';

loadRootEnvFile();
process.exitCode = await runResetLink(process.argv.slice(2), {
  connect: () => {
    const { db, close } = createDatabase(validateEnv(process.env).DATABASE_URL);
    return { db, check: databaseCheck(db), close };
  },
  out: (line) => {
    console.log(line);
  },
  err: (line) => {
    console.error(line);
  },
});
