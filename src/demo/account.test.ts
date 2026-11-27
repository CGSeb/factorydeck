import { afterEach, beforeEach, expect, it } from 'vitest';
import { signInSessions } from '../auth/sessions.ts';
import type { Database } from '../db/client.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  createDemoManager,
  demoSignInLine,
} from './account.ts';

let db: Database;
let close: () => Promise<void>;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
});

afterEach(async () => {
  await close();
});

it('creates a manager that signs in with the printed password', async () => {
  await createDemoManager(db, new Date('2026-03-12T10:00:00.000Z'));
  expect(demoSignInLine()).toBe(
    'Demo manager: demo@example.com, password: demo passphrase',
  );
  const result = await signInSessions(db).signIn({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  expect(result).toMatchObject({
    status: 'signed-in',
    account: { email: 'demo@example.com', role: 'manager' },
  });
});
