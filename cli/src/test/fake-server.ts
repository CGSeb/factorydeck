import {
  type IncomingMessage,
  type Server,
  type ServerResponse,
  createServer,
} from 'node:http';

export interface Received {
  method: string;
  path: string;
  authorization: string | undefined;
  body: unknown;
}

export type Reply =
  { status: number; body?: unknown; headers?: Record<string, string> } | 'hang';

export type Handler = (received: Received) => Reply;

export interface FakeServer {
  origin: string;
  received: Received[];
  route: (key: string, handler: Handler | Reply[]) => void;
  close: () => Promise<void>;
}

function readBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let text = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      text += chunk;
    });
    request.on('end', () => {
      try {
        resolve(text === '' ? undefined : JSON.parse(text));
      } catch {
        resolve(text);
      }
    });
  });
}

function answer(response: ServerResponse, reply: Reply): void {
  if (reply === 'hang') return;
  response.writeHead(reply.status, {
    'content-type': 'application/json',
    ...reply.headers,
  });
  response.end(reply.body === undefined ? '' : JSON.stringify(reply.body));
}

function fromList(replies: Reply[]): Handler {
  let index = 0;
  return () => {
    const reply = replies[Math.min(index, replies.length - 1)] ?? {
      status: 500,
    };
    index += 1;
    return reply;
  };
}

export async function startFakeServer(): Promise<FakeServer> {
  const routes = new Map<string, Handler>();
  const received: Received[] = [];
  const server: Server = createServer((request, response) => {
    void readBody(request).then((body) => {
      const entry: Received = {
        method: request.method ?? '',
        path: request.url ?? '',
        authorization: request.headers.authorization,
        body,
      };
      received.push(entry);
      const handler = routes.get(`${entry.method} ${entry.path}`);
      answer(
        response,
        handler === undefined ? { status: 404 } : handler(entry),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port =
    typeof address === 'object' && address !== null ? address.port : 0;
  return {
    origin: `http://127.0.0.1:${port}`,
    received,
    route: (key, handler) =>
      routes.set(key, Array.isArray(handler) ? fromList(handler) : handler),
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

export async function closedOrigin(): Promise<string> {
  const server = await startFakeServer();
  await server.close();
  return server.origin;
}
