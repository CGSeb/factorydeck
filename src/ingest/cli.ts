import {
  codexSessionsFolder,
  loadRootEnvFile,
  sessionsFolder,
  validateEnv,
} from '../config/env.ts';
import { createDatabase } from '../db/client.ts';
import { SessionsFolderNotFoundError, ingest, summaryLine } from './ingest.ts';

loadRootEnvFile();
const env = validateEnv(process.env);
const { db, close } = createDatabase(env.DATABASE_URL);
try {
  console.log(
    summaryLine(
      await ingest(db, sessionsFolder(env), {
        codexFolder: codexSessionsFolder(env),
      }),
    ),
  );
} catch (error) {
  if (!(error instanceof SessionsFolderNotFoundError)) {
    throw error;
  }
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await close();
}
