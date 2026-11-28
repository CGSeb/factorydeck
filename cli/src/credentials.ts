import { randomBytes } from 'node:crypto';
import {
  chmod,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

const accountSchema = z.object({
  id: z.union([z.number(), z.string()]),
  email: z.string(),
  name: z.string(),
  role: z.string(),
});

const entrySchema = z.object({
  token: z.string().min(1),
  account: accountSchema,
  machine: z.string(),
  loggedInAt: z.string(),
});

const credentialsSchema = z.object({
  version: z.literal(1),
  servers: z.record(z.string(), entrySchema),
});

export type Account = z.infer<typeof accountSchema>;
export type ServerEntry = z.infer<typeof entrySchema>;
export type Credentials = z.infer<typeof credentialsSchema>;

export class CredentialsError extends Error {
  readonly file: string;

  constructor(file: string, verb: 'read' | 'write') {
    super(`Could not ${verb} ${file}.`);
    this.file = file;
  }
}

export function emptyCredentials(): Credentials {
  return { version: 1, servers: {} };
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

async function readText(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw new CredentialsError(file, 'read');
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export async function readCredentials(file: string): Promise<Credentials> {
  const text = await readText(file);
  if (text === undefined || text.trim() === '') return emptyCredentials();
  const parsed = credentialsSchema.safeParse(parseJson(text));
  if (!parsed.success) throw new CredentialsError(file, 'read');
  return parsed.data;
}

async function writeAtomically(file: string, text: string): Promise<void> {
  const temporary = `${file}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    await writeFile(temporary, text, { encoding: 'utf8', mode: 0o600 });
    await chmod(temporary, 0o600).catch(() => undefined);
    await rename(temporary, file);
  } catch {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw new CredentialsError(file, 'write');
  }
}

export async function updateCredentials(
  file: string,
  change: (credentials: Credentials) => Credentials,
): Promise<void> {
  const next = change(await readCredentials(file));
  await writeAtomically(file, `${JSON.stringify(next, null, 2)}\n`);
}

export function withServer(
  origin: string,
  entry: ServerEntry | undefined,
): (credentials: Credentials) => Credentials {
  return (credentials) => {
    const servers = Object.fromEntries(
      Object.entries(credentials.servers).filter(([name]) => name !== origin),
    );
    if (entry !== undefined) servers[origin] = entry;
    return { version: 1, servers };
  };
}
