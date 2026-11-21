import { open, readdir } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

/** A session log: the main thread of a session, or one of its sub-agents. */
export interface LogFile {
  path: string;
  sessionId: string;
  /** Set for a sub-agent log, with the path of its meta file. */
  subAgent?: { id: string; metaPath: string };
}

const SUB_AGENT_FILE = /^agent-(.+)\.jsonl$/;

/** Every `*.jsonl` file under the sessions folder, main threads first, in a stable order. */
export async function findLogFiles(folder: string): Promise<LogFile[]> {
  const entries = await readdir(folder, {
    recursive: true,
    withFileTypes: true,
  });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
    .map((entry) => describe(join(entry.parentPath, entry.name)));
  return files.sort(
    (a, b) =>
      Number(a.subAgent !== undefined) - Number(b.subAgent !== undefined) ||
      a.path.localeCompare(b.path),
  );
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
