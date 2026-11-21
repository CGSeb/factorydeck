import { describe, expect, it } from 'vitest';
import { fetchHealthMessage } from './health-message.ts';

const answering =
  (status: number): typeof fetch =>
  () =>
    Promise.resolve(new Response('{}', { status }));

describe('fetchHealthMessage', () => {
  it('reports a connected database', async () => {
    await expect(fetchHealthMessage(answering(200))).resolves.toBe(
      'Database connected.',
    );
  });

  it('reports an unreachable database on 503', async () => {
    await expect(fetchHealthMessage(answering(503))).resolves.toBe(
      'Database unreachable. Start it with pnpm db:up.',
    );
  });

  it('reports an unreachable database when the API does not answer', async () => {
    const failing: typeof fetch = () =>
      Promise.reject(new TypeError('fetch failed'));
    await expect(fetchHealthMessage(failing)).resolves.toBe(
      'Database unreachable. Start it with pnpm db:up.',
    );
  });
});
