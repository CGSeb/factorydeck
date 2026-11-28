import { expect } from 'vitest';
import type { AuthHarness } from './auth-app.ts';

export interface StartedLogin {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
}

export interface CliClient {
  post: (
    path: string,
    body: unknown,
    headers?: Record<string, string>,
  ) => Promise<Response>;
  get: (path: string, headers?: Record<string, string>) => Promise<Response>;
  login: (machine?: string) => Promise<StartedLogin>;
  poll: (deviceCode: string) => Promise<Response>;
  approve: (code: string, cookie: string) => Promise<Response>;
  connect: (cookie: string, machine?: string) => Promise<string>;
  later: (ms: number) => void;
}

function text(body: unknown, key: string): string {
  if (typeof body !== 'object' || body === null || !(key in body)) return '';
  const value: unknown = Object.entries(body).find(
    ([name]) => name === key,
  )?.[1];
  return typeof value === 'string' ? value : '';
}

export function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

export function cliClient(harness: () => AuthHarness): CliClient {
  const client: CliClient = {
    post: (path, body, headers = {}) =>
      Promise.resolve(
        harness()
          .app()
          .request(path, {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...headers },
            body: typeof body === 'string' ? body : JSON.stringify(body),
          }),
      ),
    get: (path, headers = {}) =>
      Promise.resolve(harness().app().request(path, { headers })),
    login: async (machine = 'laptop') => {
      const response = await client.post('/api/cli/login', { machine });
      expect(response.status).toBe(200);
      const body: unknown = await response.json();
      return {
        deviceCode: text(body, 'deviceCode'),
        userCode: text(body, 'userCode'),
        verificationUrl: text(body, 'verificationUrl'),
      };
    },
    poll: (deviceCode) => client.post('/api/cli/login/poll', { deviceCode }),
    approve: (code, cookie) =>
      client.post('/api/auth/cli/approve', { code }, { cookie }),
    connect: async (cookie, machine) => {
      const started = await client.login(machine);
      expect((await client.approve(started.userCode, cookie)).status).toBe(204);
      const response = await client.poll(started.deviceCode);
      expect(response.status).toBe(200);
      return text(await response.json(), 'token');
    },
    later: (ms) => {
      const h = harness();
      h.clock = new Date(h.clock.getTime() + ms);
    },
  };
  return client;
}
