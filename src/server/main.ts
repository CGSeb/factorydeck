import {
  type Env,
  codexSessionsFolder,
  loadRootEnvFile,
  sessionsFolder,
  validateEnv,
  workflowConfigPath,
} from '../config/env.ts';
import { type Database, createDatabase } from '../db/client.ts';
import { featureDetail, listFeatures } from '../features/query.ts';
import { collect } from '../git-host/collect.ts';
import { collectionStatus } from '../git-host/query.ts';
import { hasFactory } from '../ingest/factory.ts';
import { ingest } from '../ingest/ingest.ts';
import { usageOverview } from '../overview/query.ts';
import { loadWorkflowConfig } from '../roles/config.ts';
import { deleteProject, factoryStatus } from '../projects/remove.ts';
import { listRoles } from '../roles/query.ts';
import { listSessions, sessionDetail } from '../sessions/query.ts';
import { listSkills, skillDetail } from '../skills/query.ts';
import { autonomyStats } from '../stats/autonomy.ts';
import { qualityStats } from '../stats/quality.ts';
import { createApp } from './app.ts';
import { type CollectLoop, startCollectLoop } from './collect-loop.ts';
import { databaseCheck } from './health.ts';
import { type IngestLoop, startIngestLoop } from './ingest-loop.ts';
import { HOST, listen } from './listen.ts';
import { UI_DIST_DIR } from './paths.ts';

function lazyCollection(
  db: Database,
  intervalMinutes: number,
): () => CollectLoop {
  let collection: CollectLoop | undefined;
  return () => {
    collection ??= startCollectLoop({
      run: async () => {
        await collect(db, { hasFactory });
      },
      intervalMs: intervalMinutes * 60_000,
      onError: (error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Git host collection failed: ${message}`);
      },
    });
    return collection;
  };
}

function startIngestion(
  db: Database,
  folder: string,
  env: Pick<Env, 'FACTORYDECK_INGEST_INTERVAL_SECONDS' | 'CODEX_SESSIONS_DIR'>,
  afterRun: () => void,
): IngestLoop {
  let lastError = '';
  return startIngestLoop({
    run: async () => {
      const result = await ingest(db, folder, {
        codexFolder: codexSessionsFolder(env),
      }).finally(afterRun);
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
}

async function main(): Promise<void> {
  loadRootEnvFile();
  const env = validateEnv(process.env);
  const config = loadWorkflowConfig(workflowConfigPath(env));
  const { db } = createDatabase(env.DATABASE_URL);
  const folder = sessionsFolder(env);
  const stateOptions = {
    inactiveAfterMinutes: env.FACTORYDECK_INACTIVE_AFTER_MINUTES,
  };
  const collectionLoop = lazyCollection(
    db,
    env.FACTORYDECK_COLLECT_INTERVAL_MINUTES,
  );
  const ingestion = startIngestion(db, folder, env, () => {
    collectionLoop();
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
      list: (query) => listSessions(db, query, stateOptions, config),
      detail: (id) => sessionDetail(db, id, stateOptions, config),
    },
    skills: {
      list: (query) => listSkills(db, query),
      detail: (skill, query) => skillDetail(db, skill, query),
    },
    roles: {
      list: (query) => listRoles(db, query, config),
      config: { path: config.path, exists: config.exists },
    },
    features: {
      list: (query) => listFeatures(db, query, config),
      detail: (key, query) =>
        featureDetail(db, key, query, { config, state: stateOptions }),
    },
    projects: {
      factoryStatus: () => factoryStatus(db, hasFactory),
      remove: (project) => deleteProject(db, project, hasFactory),
    },
    gitHost: {
      status: () => collectionStatus(db, hasFactory),
      refresh: () => collectionLoop().refresh(),
    },
    stats: {
      autonomy: (query) => autonomyStats(db, query, hasFactory),
      quality: (query) => qualityStats(db, query, hasFactory),
    },
  });
  await listen(app, env.FACTORYDECK_PORT);
  console.log(`FactoryDeck on http://${HOST}:${env.FACTORYDECK_PORT}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
