import { CLAUDE_CODE } from '../ingest/frictions.ts';
import {
  type LogLocation,
  readOccurrenceTexts,
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

export async function read(
  locations: LogLocation[],
): Promise<Record<string, unknown>> {
  const found = await readOccurrenceTexts(locations, HOME);
  return Object.fromEntries(
    locations.map(({ target }) => [target.key, found.get(target.key) ?? null]),
  );
}
