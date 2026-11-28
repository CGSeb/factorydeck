import { open, readdir } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileKeyOf } from '../cli-ingest/batch-schema.ts';
import type { CodexFile } from './codex-files.ts';

/** A session log: the main thread of a session, or one of its sub-agents. */
export interface LogFile {
  path: string;
  sessionId: string;
  /** Set for a sub-agent log, with the path of its meta file. */
  subAgent?: { id: string; metaPath: string };
  codex?: CodexFile;
}

const SUB_AGENT_FILE = /^agent-(.+)\.jsonl$/;

/**
 * Every `*.jsonl` file under the sessions folder, main threads first, in a stable order.
 * A sub-folder that cannot be read is left out, so it does not stop the others.
 */
export async function findLogFiles(folder: string): Promise<LogFile[]> {
  const paths: string[] = [];
  await collectLogPaths(folder, paths, true);
  return paths
    .map(describe)
    .sort(
      (a, b) =>
        Number(a.subAgent !== undefined) - Number(b.subAgent !== undefined) ||
        a.path.localeCompare(b.path),
    );
}

async function collectLogPaths(
  folder: string,
  paths: string[],
  isRoot: boolean,
): Promise<void> {
  const entries = await readdir(folder, { withFileTypes: true }).catch(
    (error: unknown) => {
      if (isRoot) {
        throw error;
      }
      return [];
    },
  );
  for (const entry of entries) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      await collectLogPaths(path, paths, false);
    } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      paths.push(path);
    }
  }
}

function describe(path: string): LogFile {
  const name = basename(path);
  const folder = dirname(path);
  const match = SUB_AGENT_FILE.exec(name);
  if (match?.[1] !== undefined && basename(folder) === 'subagents') {
    const id = match[1];
    return {
      path,
      sessionId: basename(dirname(folder)),
      subAgent: { id, metaPath: join(folder, `agent-${id}.meta.json`) },
    };
  }
  return { path, sessionId: name.slice(0, -'.jsonl'.length) };
}

export function logFileKey(file: LogFile): string {
  return file.codex === undefined
    ? fileKeyOf('claude-code', file.sessionId, file.subAgent?.id ?? null)
    : fileKeyOf('codex', file.sessionId, file.codex.subAgentId ?? null);
}

export function sessionIdOfPath(path: string): string {
  if (path.endsWith('.jsonl')) return describe(path).sessionId;
  return basename(dirname(dirname(path)));
}

/** The bytes of a file from `start` to `end`. */
export async function readRange(
  path: string,
  start: number,
  end: number,
): Promise<Buffer> {
  const handle = await open(path, 'r');
  try {
    const buffer = Buffer.alloc(end - start);
    let read = 0;
    while (read < buffer.length) {
      const { bytesRead } = await handle.read(
        buffer,
        read,
        buffer.length - read,
        start + read,
      );
      if (bytesRead === 0) {
        break;
      }
      read += bytesRead;
    }
    return buffer.subarray(0, read);
  } finally {
    await handle.close();
  }
}
