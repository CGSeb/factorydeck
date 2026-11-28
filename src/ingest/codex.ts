import type { LogFile } from './files.ts';
import { localLogOf, readLocalLog, storeLocalRead } from './local-read.ts';
import type { FileCounts } from './range.ts';
import { readCodexLog } from './readers/codex.ts';
import { decodeCodexState } from './readers/codex-state.ts';
import type { Run } from './store.ts';

export async function ingestCodexFile(
  run: Run,
  file: LogFile,
  home: string,
  counts: FileCounts,
): Promise<void> {
  const { codex } = file;
  if (codex === undefined) return;
  const log = localLogOf(file);
  const found = await readLocalLog(run, log, {
    current: (state) => decodeCodexState(state) !== undefined,
    read: (from, bytes, readerState) =>
      readCodexLog({
        bytes,
        from,
        readerState,
        home,
        log: {
          sessionId: file.sessionId,
          subAgentId: log.subAgentId,
          cwd: codex.cwd,
        },
      }),
  });
  if (found !== undefined) await storeLocalRead(run, log, found, counts);
}
