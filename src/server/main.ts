import { loadRootEnvFile, sessionsFolder, validateEnv } from '../config/env.ts';
import { createDatabase } from '../db/client.ts';
import { ingest } from '../ingest/ingest.ts';
import { usageOverview } from '../overview/query.ts';
import { listSessions, sessionDetail } from '../sessions/query.ts';
import { listSkills, skillDetail } from '../skills/query.ts';
import { createApp } from './app.ts';
import { databaseCheck } from './health.ts';
import { startIngestLoop } from './ingest-loop.ts';
import { HOST, listen } from './listen.ts';
import { UI_DIST_DIR } from './paths.ts';

async function main(): Promise<void> {
  loadRootEnvFile();
  const env = validateEnv(process.env);
  const { db } = createDatabase(env.DATABASE_URL);
  const folder = sessionsFolder(env);
  const stateOptions = {
    inactiveAfterMinutes: env.FACTORYDECK_INACTIVE_AFTER_MINUTES,
  };
  let lastError = '';
  const ingestion = startIngestLoop({
    run: async () => {
      const result = await ingest(db, folder);
      lastError = '';
      return result.status === 'done';
    },
    intervalMs: env.FACTORYDECK_INGEST_INTERVAL_SECONDS * 1000,
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (message !== lastError) console.error(`Ingestion failed: ${message}`);
      lastError = message;
    },
  });
  const app = createApp({
    checkDatabase: databaseCheck(db),
    uiDir: UI_DIST_DIR,
    overview: {
      load: (query) => usageOverview(db, query),
      sessionsFolder: folder,
      refreshSeconds: env.FACTORYDECK_INGEST_INTERVAL_SECONDS,
      updatedAt: ingestion.lastFinishedAt,
    },
    sessions: {
      list: (query) => listSessions(db, query, stateOptions),
      detail: (id) => sessionDetail(db, id, stateOptions),
    },
    skills: {
      list: (query) => listSkills(db, query),
      detail: (skill, query) => skillDetail(db, skill, query),
    },
  });
  await listen(app, env.FACTORYDECK_PORT);
  console.log(`FactoryDeck on http://${HOST}:${env.FACTORYDECK_PORT}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
