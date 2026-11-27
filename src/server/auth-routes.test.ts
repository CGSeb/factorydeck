import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { verifyPassword } from '../auth/secrets.ts';
import { signInSessions } from '../auth/sessions.ts';
import { type Setup, firstManagerSetup } from '../auth/setup.ts';
import type { Database } from '../db/client.ts';
import { account, accountToken, signInSession } from '../db/schema.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  unusedFeatures,
  unusedGitHost,
  unusedProjects,
  unusedRoles,
  unusedSkills,
  unusedStats,
} from '../test/skill-source.ts';
import { type OverviewSource, createApp } from './app.ts';
import type { SessionSource } from './session-routes.ts';

const CODE = 'AB23CD45';
const NOW = new Date('2026-03-12T10:00:00.000Z');
const PASSWORD = '  correct horse battery ';

const overview: OverviewSource = {
  load: () => Promise.reject(new Error('Not used')),
  sessionsFolder: '/logs/claude',
  refreshSeconds: 10,
  updatedAt: () => undefined,
};

const sessions: SessionSource = {
  list: () => Promise.reject(new Error('Not used')),
  detail: () => Promise.reject(new Error('Not used')),
};

function app(setup: Setup, up = true) {
  return createApp({
    checkDatabase: () => Promise.resolve(up),
    uiDir: '/nonexistent/factorydeck-ui',
    overview,
    sessions,
    skills: unusedSkills,
    roles: unusedRoles,
    features: unusedFeatures,
    projects: unusedProjects,
    gitHost: unusedGitHost,
    stats: unusedStats,
    auth: { ...setup, ...signInSessions(db, { now: () => NOW }) },
  });
}

let db: Database;
let close: () => Promise<void>;
let logged: string[];

async function startedApp() {
  const setup = firstManagerSetup(db, {
    log: (line) => logged.push(line),
    newCode: () => CODE,
    now: () => NOW,
  });
  await setup.start();
  return app(setup);
}

function post(
  server: ReturnType<typeof app>,
  body: unknown,
  headers: Record<string, string> = {},
  url = 'http://127.0.0.1:4317/api/auth/setup',
) {
  return server.request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const first = {
  code: CODE,
  email: ' Ada@Example.test ',
  name: ' Ada Lovelace ',
  password: PASSWORD,
};

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
  logged = [];
});

afterEach(async () => {
  await close();
});

describe('setup code at start', () => {
  it('logs a new code when no account exists, and nothing once one does', async () => {
    await startedApp();
    expect(logged).toEqual([`No account yet. Setup code: ${CODE}`]);
    await post(await startedApp(), first);
    logged = [];
    const later = await startedApp();
    expect(logged).toEqual([]);
    expect((await post(later, first)).status).toBe(409);
  });

  it('replaces the code at each start while no account exists', async () => {
    const codes = ['AAAAAAAA', 'BBBBBBBB'];
    const setup = firstManagerSetup(db, {
      log: (line) => logged.push(line),
      newCode: () => codes.shift() ?? '',
    });
    await setup.start();
    await setup.start();
    expect(logged).toEqual([
      'No account yet. Setup code: AAAAAAAA',
      'No account yet. Setup code: BBBBBBBB',
    ]);
    const server = app(setup);
    expect(
      await (await post(server, { ...first, code: 'AAAAAAAA' })).json(),
    ).toEqual({ error: 'Wrong setup code' });
    expect((await post(server, { ...first, code: 'bbbbbbbb' })).status).toBe(
      201,
    );
  });
});

describe('GET /api/auth/state', () => {
  it('answers setup true while no account exists, then false', async () => {
    const server = await startedApp();
    const before = await server.request('/api/auth/state');
    expect(before.status).toBe(200);
    expect(await before.json()).toEqual({ setup: true });
    await post(server, first);
    expect(await (await server.request('/api/auth/state')).json()).toEqual({
      setup: false,
    });
  });

  it('answers 503 when the database is unreachable', async () => {
    const response = await app(
      firstManagerSetup(db, { log: () => undefined }),
      false,
    ).request('/api/auth/state');
    expect(response.status).toBe(503);
  });
});

describe('POST /api/auth/setup', () => {
  it('creates the first manager, opens a session and answers 201', async () => {
    const response = await post(await startedApp(), {
      ...first,
      code: `  ${CODE.toLowerCase()} `,
    });
    expect(response.status).toBe(201);
    const body = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['email', 'id', 'name', 'role']);
    expect(typeof body['id']).toBe('number');
    expect(body).toMatchObject({
      email: 'ada@example.test',
      name: 'Ada Lovelace',
      role: 'manager',
    });
    const cookie = response.headers.get('set-cookie') ?? '';
    const token = /^factorydeck_session=([^;]+);/.exec(cookie)?.[1] ?? '';
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(cookie.split('; ').slice(1).sort()).toEqual([
      'HttpOnly',
      'Max-Age=2592000',
      'Path=/',
      'SameSite=Lax',
    ]);

    const [stored] = await db.select().from(account);
    expect(stored).toMatchObject({
      id: body['id'],
      email: 'ada@example.test',
      name: 'Ada Lovelace',
      role: 'manager',
      active: true,
      createdAt: NOW,
      lastSignInAt: NOW,
    });
    await expect(
      db.insert(account).values({
        email: 'ada@example.test',
        name: 'Ada again',
        passwordHash: 'scrypt$c2FsdA$a2V5',
        role: 'dev',
        createdAt: NOW,
      }),
    ).rejects.toMatchObject({ cause: { code: '23505' } });
    expect(stored?.passwordHash).not.toContain(PASSWORD.trim());
    expect(await verifyPassword(PASSWORD, stored?.passwordHash ?? '')).toBe(
      true,
    );
    expect(
      await verifyPassword(PASSWORD.trim(), stored?.passwordHash ?? ''),
    ).toBe(false);
    const signIns = await db.select().from(signInSession);
    expect(signIns).toHaveLength(1);
    expect(signIns[0]).toMatchObject({
      accountId: body['id'],
      createdAt: NOW,
      lastUsedAt: NOW,
    });
    expect(signIns[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(signIns)).not.toContain(token);
    expect(await db.select().from(accountToken)).toEqual([]);
    expect(logged.join('\n')).not.toContain(PASSWORD.trim());
  });

  it('sets Secure on the cookie over HTTPS, directly or behind a proxy', async () => {
    const server = await startedApp();
    const proxied = await post(server, first, { 'x-forwarded-proto': 'https' });
    expect(proxied.status).toBe(201);
    expect(proxied.headers.get('set-cookie')).toMatch(/; Secure(;|$)/);

    await close();
    ({ db, close } = await createTestDatabase());
    const direct = await post(
      await startedApp(),
      first,
      {},
      'https://factorydeck.example.test/api/auth/setup',
    );
    expect(direct.status).toBe(201);
    expect(direct.headers.get('set-cookie')).toMatch(/; Secure(;|$)/);
  });

  it('answers 403 on a wrong code, and creates nothing', async () => {
    const server = await startedApp();
    for (const code of ['ZZZZZZZZ', 'AB23 CD45', '', undefined]) {
      const response = await post(server, { ...first, code });
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: 'Wrong setup code' });
      expect(response.headers.get('set-cookie')).toBeNull();
    }
    expect(await db.select().from(account)).toEqual([]);
    expect(await db.select().from(signInSession)).toEqual([]);
  });

  it('answers 403 when the body is not a JSON object', async () => {
    const response = await post(await startedApp(), 'not json');
    expect(response.status).toBe(403);
  });

  it.each([
    [
      'email',
      'ada.example.test',
      'Email must have one @ with text on both sides',
    ],
    ['email', `a@${'b'.repeat(253)}`, 'Email must be at most 254 characters'],
    ['name', ' ', 'Name is required'],
    ['name', 'n'.repeat(81), 'Name must be at most 80 characters'],
    ['password', 'short', 'Password must be at least 12 characters'],
    ['password', 'p'.repeat(201), 'Password must be at most 200 characters'],
  ])(
    'answers 400 on an invalid %s, and creates nothing',
    async (field, value, error) => {
      const response = await post(await startedApp(), {
        ...first,
        [field]: value,
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error, field });
      expect(response.headers.get('set-cookie')).toBeNull();
      expect(await db.select().from(account)).toEqual([]);
    },
  );

  it('answers 409 on a second setup, and creates nothing', async () => {
    const server = await startedApp();
    expect((await post(server, first)).status).toBe(201);
    const second = await post(server, {
      ...first,
      email: 'grace@example.test',
    });
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ error: 'Already set up' });
    expect(second.headers.get('set-cookie')).toBeNull();
    expect(await db.select().from(account)).toHaveLength(1);
    expect(await db.select().from(signInSession)).toHaveLength(1);
  });

  it('creates one account when two setups run at once', async () => {
    const server = await startedApp();
    const responses = await Promise.all(
      ['ada', 'grace', 'hedy', 'joan'].map((name) =>
        Promise.resolve(
          post(server, { ...first, email: `${name}@example.test`, name }),
        ),
      ),
    );
    expect(responses.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      201, 409, 409, 409,
    ]);
    expect(await db.select().from(account)).toHaveLength(1);
    expect(await db.select().from(signInSession)).toHaveLength(1);
  });

  it('answers 503 when the database is unreachable', async () => {
    const response = await post(
      app(firstManagerSetup(db, { log: () => undefined }), false),
      first,
    );
    expect(response.status).toBe(503);
  });
});
