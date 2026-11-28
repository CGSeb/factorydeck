import { afterEach, beforeEach } from 'vitest';
import { apiCall, ingestFile, session, subAgent } from '../db/schema.ts';
import { type AuthHarness, authHarness, signedIn } from './auth-app.ts';
import { ingestRequest } from './cli-batch.ts';
import { cliClient } from './cli-client.ts';

export interface IngestApp {
  h: () => AuthHarness;
  token: () => string;
  connect: (email: string, name: string, machine: string) => Promise<string>;
  send: (
    body: unknown,
    options?: Parameters<typeof ingestRequest>[2],
    as?: string,
  ) => Promise<{ status: number; body: unknown }>;
  stored: () => Promise<{
    sessions: (typeof session.$inferSelect)[];
    subAgents: (typeof subAgent.$inferSelect)[];
    calls: (typeof apiCall.$inferSelect)[];
    files: (typeof ingestFile.$inferSelect)[];
  }>;
}

export function useIngestApp(): IngestApp {
  let h: AuthHarness | undefined;
  let token = '';
  const harness = (): AuthHarness => {
    if (h === undefined) throw new Error('No harness');
    return h;
  };
  const client = cliClient(harness);
  const app: IngestApp = {
    h: harness,
    token: () => token,
    connect: async (email, name, machine) => {
      await harness().addAccount(email, { name });
      return client.connect(await signedIn(harness().app(), email), machine);
    },
    send: async (body, options = {}, as = token) => {
      const response = await harness()
        .app()
        .request('/api/cli/ingest', ingestRequest(body, as, options));
      return { status: response.status, body: await response.json() };
    },
    stored: async () => {
      const { db } = harness();
      const [sessions, subAgents, calls, files] = await Promise.all([
        db.select().from(session).orderBy(session.id),
        db.select().from(subAgent).orderBy(subAgent.sessionId, subAgent.id),
        db.select().from(apiCall).orderBy(apiCall.requestKey),
        db.select().from(ingestFile).orderBy(ingestFile.fileKey),
      ]);
      return { sessions, subAgents, calls, files };
    },
  };
  beforeEach(async () => {
    h = await authHarness();
    token = await app.connect('ada@example.test', 'Ada', 'laptop');
  });
  afterEach(async () => {
    await harness().close();
  });
  return app;
}
