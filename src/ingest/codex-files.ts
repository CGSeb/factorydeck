import { open, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type CodexMeta,
  codexMetaOf,
  parseCodexRecord,
} from './codex-format.ts';
import type { LogFile } from './files.ts';
import { wslPath } from './wsl.ts';

export {
  CODEX,
  CODEX_RECORD_TYPES,
  CODEX_SHELL_TOOLS,
  type CodexMeta,
  codexMetaOf,
  parseCodexRecord,
} from './codex-format.ts';

export interface CodexFile {
  meta: CodexMeta;
  subAgentId?: string;
  cwd: string | null;
}

const ROLLOUT_FILE = /^rollout-.*\.jsonl$/;

async function firstLine(path: string): Promise<string | undefined> {
  const handle = await open(path, 'r');
  try {
    const parts: Buffer[] = [];
    let position = 0;
    for (;;) {
      const buffer = Buffer.alloc(64 * 1024);
      const { bytesRead } = await handle.read(
        buffer,
        0,
        buffer.length,
        position,
      );
      if (bytesRead === 0) return undefined;
      const part = buffer.subarray(0, bytesRead);
      const end = part.indexOf(0x0a);
      if (end !== -1) {
        parts.push(part.subarray(0, end));
        return Buffer.concat(parts).toString('utf8');
      }
      parts.push(part);
      position += bytesRead;
    }
  } finally {
    await handle.close();
  }
}

const metaCache = new Map<string, { size: number; meta: CodexMeta }>();

async function metaOf(path: string): Promise<CodexMeta | undefined> {
  const size = await stat(path).then(
    (stats) => stats.size,
    () => undefined,
  );
  if (size === undefined) return undefined;
  const cached = metaCache.get(path);
  if (cached !== undefined && cached.size <= size) {
    cached.size = size;
    return cached.meta;
  }
  const line = await firstLine(path).catch(() => undefined);
  const record = line === undefined ? undefined : parseCodexRecord(line.trim());
  const meta = record === undefined ? undefined : codexMetaOf(record);
  if (meta === undefined) {
    metaCache.delete(path);
    return undefined;
  }
  metaCache.set(path, { size, meta });
  return meta;
}

async function collectRollouts(folder: string, paths: string[]): Promise<void> {
  const entries = await readdir(folder, { withFileTypes: true }).catch(
    () => [],
  );
  for (const entry of entries) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      await collectRollouts(path, paths);
    } else if (entry.isFile() && ROLLOUT_FILE.test(entry.name)) {
      paths.push(path);
    }
  }
}

function rootOf(
  meta: CodexMeta,
  subAgents: ReadonlyMap<string, CodexMeta>,
): string {
  const seen = new Set<string>();
  let current = meta;
  for (;;) {
    if (current.sessionId !== null && current.sessionId !== current.id) {
      return current.sessionId;
    }
    const parent = current.parentThreadId ?? current.id;
    const next = subAgents.get(parent);
    if (next === undefined || seen.has(parent)) return parent;
    seen.add(parent);
    current = next;
  }
}

export async function findCodexFiles(
  folder: string,
  { wsl }: { wsl: boolean },
): Promise<LogFile[]> {
  const isFolder = await stat(folder).then(
    (stats) => stats.isDirectory(),
    () => false,
  );
  if (!isFolder) return [];
  const paths: string[] = [];
  await collectRollouts(folder, paths);
  const found: { path: string; meta: CodexMeta }[] = [];
  for (const path of paths) {
    const meta = await metaOf(path);
    if (meta !== undefined) found.push({ path, meta });
  }
  const subAgents = new Map(
    found
      .filter(({ meta }) => meta.parentThreadId !== null)
      .map(({ meta }) => [meta.id, meta]),
  );
  return found
    .map(({ path, meta }): LogFile => {
      const isSubAgent = meta.parentThreadId !== null;
      const cwd = meta.cwd === null ? null : wsl ? wslPath(meta.cwd) : meta.cwd;
      return {
        path,
        sessionId: isSubAgent ? rootOf(meta, subAgents) : meta.id,
        codex: isSubAgent ? { meta, subAgentId: meta.id, cwd } : { meta, cwd },
      };
    })
    .sort(
      (a, b) =>
        Number(a.codex?.subAgentId !== undefined) -
          Number(b.codex?.subAgentId !== undefined) ||
        a.path.localeCompare(b.path),
    );
}

export function codexSessionCwd(files: readonly LogFile[]): string | null {
  const root = files.find(
    (file) => file.codex !== undefined && file.codex.subAgentId === undefined,
  );
  if (root?.codex?.cwd != null) return root.codex.cwd;
  const candidates = files.flatMap((file) =>
    file.codex?.cwd == null
      ? []
      : [
          {
            cwd: file.codex.cwd,
            id: file.codex.meta.id,
            at: file.codex.meta.firstAt?.getTime() ?? Number.POSITIVE_INFINITY,
          },
        ],
  );
  candidates.sort(
    (a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  return candidates[0]?.cwd ?? null;
}
