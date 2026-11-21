import { type Socket, createServer } from 'node:net';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../db/client.ts';
import { databaseCheck } from './health.ts';

function closedPort(): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer().listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

describe('databaseCheck', () => {
  it('resolves false instead of throwing when the database does not answer', async () => {
    const port = await closedPort();
    const { db, close } = createDatabase(
      `postgres://user:secret@127.0.0.1:${port}/factorydeck`,
    );
    await expect(databaseCheck(db)()).resolves.toBe(false);
    await close();
  });

  it('resolves false when the connection is accepted but never completes', async () => {
    const sockets: Socket[] = [];
    const silent = createServer((socket) => sockets.push(socket));
    await new Promise<void>((resolve) =>
      silent.listen(0, '127.0.0.1', resolve),
    );
    const address = silent.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const { db, close } = createDatabase(
      `postgres://user:secret@127.0.0.1:${port}/factorydeck`,
      200,
    );

    const started = Date.now();
    await expect(databaseCheck(db)()).resolves.toBe(false);
    expect(Date.now() - started).toBeLessThan(1000);

    await close();
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => silent.close(resolve));
  });

  it('resolves false within its timeout when a query never answers', async () => {
    const hanging = {
      execute: () => new Promise(() => undefined),
    } as unknown as NodePgDatabase;
    const started = Date.now();
    await expect(databaseCheck(hanging, 200)()).resolves.toBe(false);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
