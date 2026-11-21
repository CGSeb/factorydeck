import { type ServerType, serve } from '@hono/node-server';
import type { Hono } from 'hono';

/** The only address FactoryDeck listens on: it is a single-user, local tool. */
export const HOST = '127.0.0.1';

/** Starts serving `app` on `HOST:port`, rejecting with a readable message when the port is taken. */
export function listen(app: Hono, port: number): Promise<ServerType> {
  return new Promise((resolve, reject) => {
    const server = serve({ fetch: app.fetch, hostname: HOST, port }, () =>
      resolve(server),
    );
    server.once('error', (error: NodeJS.ErrnoException) => {
      reject(
        error.code === 'EADDRINUSE'
          ? new Error(
              `Port ${port} is already in use. Set FACTORYDECK_PORT in .env.`,
            )
          : error,
      );
    });
  });
}
