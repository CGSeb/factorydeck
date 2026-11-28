import { loadRootEnvFile, validateEnv } from '../config/env.ts';
import { createDatabase } from '../db/client.ts';
import { hasFactory } from '../ingest/factory.ts';
import { secretKey } from '../team/token-cipher.ts';
import { collect, collectSummary } from './collect.ts';

loadRootEnvFile();
const env = validateEnv(process.env);
const { db, close } = createDatabase(env.DATABASE_URL);
try {
  const result = await collect(db, {
    hasFactory,
    secretKey: secretKey(env.FACTORYDECK_SECRET_KEY),
  });
  const [summary, ...failures] = collectSummary(result);
  console.log(summary);
  for (const line of failures) console.error(line);
  if (result.failures.length > 0) process.exitCode = 1;
} finally {
  await close();
}
