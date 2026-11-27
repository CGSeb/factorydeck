import type { Database } from '../db/client.ts';
import { accountFields } from './fields.ts';
import {
  hashPassword,
  hashToken,
  newSessionToken,
  newSetupCode,
  sameSetupCode,
} from './secrets.ts';
import { createFirstAccount, hasAccount } from './store.ts';
import type { SetupResult } from './types.ts';

export interface SetupOptions {
  log: (line: string) => void;
  newCode?: () => string;
  now?: () => Date;
}

export interface Setup {
  start: () => Promise<void>;
  needed: () => Promise<boolean>;
  run: (body: Record<string, unknown>) => Promise<SetupResult>;
}

export function firstManagerSetup(db: Database, options: SetupOptions): Setup {
  const newCode = options.newCode ?? newSetupCode;
  const now = options.now ?? (() => new Date());
  let code: string | undefined;
  return {
    start: async () => {
      code = undefined;
      if (await hasAccount(db)) return;
      code = newCode();
      options.log(`No account yet. Setup code: ${code}`);
    },
    needed: async () => !(await hasAccount(db)),
    run: async (body) => {
      if (await hasAccount(db)) return { status: 'already-set-up' };
      if (code === undefined || !sameSetupCode(code, body['code'])) {
        return { status: 'wrong-code' };
      }
      const fields = accountFields(body);
      if (!fields.ok) {
        return { status: 'invalid', error: fields.error, field: fields.field };
      }
      const sessionToken = newSessionToken();
      const created = await createFirstAccount(db, {
        email: fields.value.email,
        name: fields.value.name,
        passwordHash: await hashPassword(fields.value.password),
        sessionTokenHash: hashToken(sessionToken),
        now: now(),
      });
      if (created === undefined) return { status: 'already-set-up' };
      code = undefined;
      return { status: 'created', account: created, sessionToken };
    },
  };
}
