import type { Database } from '../db/client.ts';
import { account } from '../db/schema.ts';
import { hashPassword } from '../auth/secrets.ts';

export const DEMO_EMAIL = 'demo@example.com';
export const DEMO_PASSWORD = 'demo passphrase';

export async function createDemoManager(
  db: Database,
  now: Date,
): Promise<void> {
  await db.insert(account).values({
    email: DEMO_EMAIL,
    name: 'Demo',
    passwordHash: await hashPassword(DEMO_PASSWORD),
    role: 'manager',
    createdAt: now,
  });
}

export function demoSignInLine(): string {
  return `Demo manager: ${DEMO_EMAIL}, password: ${DEMO_PASSWORD}`;
}
