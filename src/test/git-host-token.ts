import { afterEach, beforeEach } from 'vitest';
import { z } from 'zod';
import { type AuthHarness, authHarness, signedIn } from './auth-app.ts';
import { type FakeHostCli, fakeHostCli, fakeRunner } from './fake-host-cli.ts';

export const KEY = Buffer.alloc(32, 9).toString('base64');
export const SHOP = 'https://github.com/owner/shop.git';
export const REPO = 'repos/owner/shop';
export const FILE = `${REPO}/contents/docs/agents/factory.yml?ref=trunk`;
export const LAB = 'git@git.example.test:group/shop.git';
export const LAB_PROJECT = 'projects/group%2Fshop';
export const LAB_FILE = `${LAB_PROJECT}/repository/files/docs%2Fagents%2Ffactory.yml?ref=trunk`;

export interface TokenHarness {
  h: AuthHarness;
  fake: FakeHostCli;
}

export function useTokenHarness(): TokenHarness {
  let current: TokenHarness | undefined;
  const now = (): TokenHarness => {
    if (current === undefined) throw new Error('No token harness yet');
    return current;
  };
  beforeEach(async () => {
    const h = await authHarness();
    const fake = await fakeHostCli();
    h.secretKey = KEY;
    h.hostCli = fakeRunner(fake, {
      PATH: process.env['PATH'] ?? '',
      GH_TOKEN: 'server-token',
    });
    current = { h, fake };
  });
  afterEach(async () => {
    await now().fake.remove();
    await now().h.close();
    current = undefined;
  });
  return {
    get h() {
      return now().h;
    },
    get fake() {
      return now().fake;
    },
  };
}

export interface Sent {
  cookie: string;
  body?: unknown;
}

export function send(
  { h }: TokenHarness,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  { cookie, body }: Sent,
): Promise<Response> {
  return Promise.resolve(
    h.app().request(path, {
      method,
      headers: { 'content-type': 'application/json', cookie },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}

export async function manager({ h }: TokenHarness): Promise<string> {
  await h.addAccount('ada@example.test', { role: 'manager', name: 'Ada' });
  return signedIn(h.app(), 'ada@example.test');
}

const Added = z.object({ id: z.number() });

export async function addProject(
  t: TokenHarness,
  cookie: string,
  remote: string,
): Promise<number> {
  const response = await send(t, 'POST', '/api/admin/projects', {
    cookie,
    body: { remote },
  });
  return Added.parse(await response.json()).id;
}

export function putToken(
  t: TokenHarness,
  id: number | string,
  cookie: string,
  body: unknown,
): Promise<Response> {
  return send(t, 'PUT', `/api/admin/projects/${String(id)}/git-host`, {
    cookie,
    body,
  });
}

export async function goodGitHub({ fake }: TokenHarness): Promise<void> {
  await fake.answer(REPO, { status: 200, body: { default_branch: 'trunk' } });
  await fake.answer(FILE, { status: 200, body: { type: 'file' } });
}
