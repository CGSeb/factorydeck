import type { LogTexts } from '../frictions/occurrence-types.ts';
import { CLAUDE_CODE } from '../ingest/frictions.ts';
import {
  type LogLocation,
  excerptOf,
  readLogTexts,
} from '../frictions/occurrences.ts';

export const HOME = '/home/dev';

export function at(
  path: string,
  recordUuid: string,
  {
    position = 0,
    kind = 'tool-error',
    agent = CLAUDE_CODE,
  }: { position?: number; kind?: string; agent?: string } = {},
): LogLocation {
  return {
    agent,
    path,
    target: {
      key: `${recordUuid}#${String(position)}`,
      recordUuid,
      position,
      kind,
    },
  };
}

export async function readRaw(
  locations: LogLocation[],
): Promise<Record<string, LogTexts | null>> {
  const found = await readLogTexts(locations, HOME);
  return Object.fromEntries(
    locations.map(({ target }) => [target.key, found.get(target.key) ?? null]),
  );
}

function headTexts(texts: LogTexts | null): unknown {
  if (texts === null) return null;
  const { texts: shown } = excerptOf(texts, false);
  if (shown.kind === 'stop-blocked') return shown;
  return { kind: shown.kind, input: shown.input, error: shown.error };
}

export async function read(
  locations: LogLocation[],
): Promise<Record<string, unknown>> {
  const found = await readLogTexts(locations, HOME);
  return Object.fromEntries(
    locations.map(({ target }) => [
      target.key,
      headTexts(found.get(target.key) ?? null),
    ]),
  );
}
