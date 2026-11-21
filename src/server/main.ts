import { loadRootEnvFile, validateEnv } from '../config/env.ts';
import { createDatabase } from '../db/client.ts';
import { createApp } from './app.ts';
import { databaseCheck } from './health.ts';
import { HOST, listen } from './listen.ts';
import { UI_DIST_DIR } from './paths.ts';

async function main(): Promise<void> {
  loadRootEnvFile();
  const env = validateEnv(process.env);
  const { db } = createDatabase(env.DATABASE_URL);
  const app = createApp({
    checkDatabase: databaseCheck(db),
    uiDir: UI_DIST_DIR,
  });
  await listen(app, env.FACTORYDECK_PORT);
  console.log(`FactoryDeck on http://${HOST}:${env.FACTORYDECK_PORT}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
