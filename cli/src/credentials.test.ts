import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CredentialsError,
  type ServerEntry,
  readCredentials,
  updateCredentials,
  withServer,
} from './credentials.ts';

let root: string;
let file: string;

const ENTRY: ServerEntry = {
  token: 'fdk_a',
  account: { id: 1, email: 'ada@example.test', name: 'Ada', role: 'dev' },
  machine: 'laptop',
  loggedInAt: '2026-01-02T03:04:05.000Z',
};

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'factorydeck-credentials-'));
  file = path.join(root, 'home', 'nested', 'credentials.json');
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('credentials.json', () => {
  it('holds no server when it is missing or empty', async () => {
    expect(await readCredentials(file)).toEqual({ version: 1, servers: {} });
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, ' \n');
    expect(await readCredentials(file)).toEqual({ version: 1, servers: {} });
  });

  it.each([
    '{',
    '[]',
    '{"version":2,"servers":{}}',
    '{"version":1,"servers":{"x":{"token":""}}}',
  ])('cannot be read when it holds %s', async (text) => {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text);
    await expect(readCredentials(file)).rejects.toThrow(
      new CredentialsError(file, 'read'),
    );
  });

  it('cannot be read when it is a folder', async () => {
    await mkdir(file, { recursive: true });
    await expect(readCredentials(file)).rejects.toThrow(
      `Could not read ${file}.`,
    );
  });

  it('is written atomically with mode 600 in a folder made with mode 700', async () => {
    await updateCredentials(file, withServer('https://a.test', ENTRY));
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
      version: 1,
      servers: { 'https://a.test': ENTRY },
    });
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect((await stat(path.dirname(file))).mode & 0o777).toBe(0o700);
    expect((await stat(path.dirname(path.dirname(file)))).mode & 0o777).toBe(
      0o700,
    );
    expect(await readdir(path.dirname(file))).toEqual(['credentials.json']);
  });

  it('reads the file again right before each write, so two logins keep both servers', async () => {
    await updateCredentials(file, withServer('https://a.test', ENTRY));
    await updateCredentials(
      file,
      withServer('https://b.test', { ...ENTRY, token: 'fdk_b' }),
    );
    expect(Object.keys((await readCredentials(file)).servers)).toEqual([
      'https://a.test',
      'https://b.test',
    ]);
    await updateCredentials(file, withServer('https://a.test', undefined));
    expect(Object.keys((await readCredentials(file)).servers)).toEqual([
      'https://b.test',
    ]);
  });

  it('leaves an invalid file as it is', async () => {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, '{ broken');
    await expect(
      updateCredentials(file, withServer('https://a.test', ENTRY)),
    ).rejects.toThrow(CredentialsError);
    expect(await readFile(file, 'utf8')).toBe('{ broken');
  });
});
