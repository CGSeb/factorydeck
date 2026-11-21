import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import {
  type LogRecord,
  isSidechain,
  parseRecord,
  stringOf,
  timestampOf,
} from './records.ts';

export const FACTORY_FILE = join('docs', 'agents', 'factory.yml');

export type FactoryCheck = (root: string) => Promise<boolean>;

export function factoryFile(root: string): string {
  return join(root, FACTORY_FILE);
}

export const hasFactory: FactoryCheck = async (root) =>
  stat(factoryFile(root)).then(
    (stats) => stats.isFile(),
    () => false,
  );

export function cachedFactoryCheck(check: FactoryCheck): FactoryCheck {
  const results = new Map<string, Promise<boolean>>();
  return (root) => {
    const known = results.get(root);
    if (known !== undefined) return known;
    const result = check(root);
    results.set(root, result);
    return result;
  };
}

interface LogStart {
  cwd: string | undefined;
  firstAt: Date | undefined;
}

function notice(found: LogStart, record: LogRecord, main: boolean): boolean {
  found.firstAt ??= timestampOf(record);
  const cwd = stringOf(record, 'cwd');
  if (found.cwd === undefined && cwd !== undefined && cwd !== '') {
    found.cwd = cwd;
  }
  return found.cwd !== undefined && (main || found.firstAt !== undefined);
}

async function scanLog(
  path: string,
  main: boolean,
): Promise<LogStart | undefined> {
  const found: LogStart = { cwd: undefined, firstAt: undefined };
  const lines = createInterface({
    input: createReadStream(path, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  try {
    for await (const line of lines) {
      const record = parseRecord(line.trim());
      if (record === undefined || (main && isSidechain(record))) continue;
      if (notice(found, record, main)) break;
    }
  } catch {
    return undefined;
  } finally {
    lines.close();
  }
  return found;
}

export interface SessionLogs {
  main: string | undefined;
  subAgents: { id: string; path: string }[];
}

export async function sessionCwd(
  logs: SessionLogs,
): Promise<string | null | undefined> {
  if (logs.main !== undefined) {
    const main = await scanLog(logs.main, true);
    if (main === undefined) return undefined;
    if (main.cwd !== undefined) return main.cwd;
  }
  const candidates: { id: string; cwd: string; firstAt: number }[] = [];
  for (const agent of logs.subAgents) {
    const start = await scanLog(agent.path, false);
    if (start === undefined) return undefined;
    if (start.cwd === undefined) continue;
    candidates.push({
      id: agent.id,
      cwd: start.cwd,
      firstAt: start.firstAt?.getTime() ?? Number.POSITIVE_INFINITY,
    });
  }
  candidates.sort(
    (a, b) => a.firstAt - b.firstAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  return candidates[0]?.cwd ?? null;
}
