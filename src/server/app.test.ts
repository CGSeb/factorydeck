import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from './app.ts';

const builtUi = mkdtempSync(join(tmpdir(), 'factorydeck-ui-'));
writeFileSync(join(builtUi, 'index.html'), '<title>FactoryDeck</title>');
mkdirSync(join(builtUi, 'assets'));
writeFileSync(join(builtUi, 'assets', 'app.js'), 'console.log(1);');
const missingUi = join(builtUi, 'missing');

afterAll(() => rmSync(builtUi, { recursive: true, force: true }));

const up = (): Promise<boolean> => Promise.resolve(true);
const down = (): Promise<boolean> => Promise.resolve(false);

describe('GET /api/health', () => {
  it('answers 200 ok when the database answers', async () => {
    const response = await createApp({
      checkDatabase: up,
      uiDir: builtUi,
    }).request('/api/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', database: 'ok' });
  });

  it('answers 503 degraded when the database does not answer', async () => {
    const response = await createApp({
      checkDatabase: down,
      uiDir: builtUi,
    }).request('/api/health');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'degraded',
      database: 'unreachable',
    });
  });
});

describe('other API paths', () => {
  it.each(['/api/unknown', '/api/health/deep', '/api/'])(
    'answers 404 JSON for %s',
    async (path) => {
      const response = await createApp({
        checkDatabase: up,
        uiDir: builtUi,
      }).request(path);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Not found' });
    },
  );

  it('answers 404 JSON when built UI is missing too', async () => {
    const response = await createApp({
      checkDatabase: up,
      uiDir: missingUi,
    }).request('/api/nope');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });
});

describe('UI', () => {
  const app = createApp({ checkDatabase: up, uiDir: builtUi });

  it('serves the built index page at /', async () => {
    const response = await app.request('/');
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<title>FactoryDeck</title>');
  });

  it('serves built assets', async () => {
    const response = await app.request('/assets/app.js');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('console.log(1);');
  });

  it('falls back to the index page on a client route', async () => {
    const response = await app.request('/sessions/42');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('<title>FactoryDeck</title>');
  });

  it('answers a plain-text hint when the UI was never built', async () => {
    const response = await createApp({
      checkDatabase: up,
      uiDir: missingUi,
    }).request('/');
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(await response.text()).toBe('UI not built. Run pnpm build.');
  });
});
