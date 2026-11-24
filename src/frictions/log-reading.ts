import type { LogTexts } from './occurrence-types.ts';

export interface LogTarget {
  key: string;
  recordUuid: string;
  position: number;
  kind: string;
}

export interface FileReading {
  targets: readonly LogTarget[];
  home: string;
  found: Map<string, LogTexts | null>;
}

export function settle(
  reading: FileReading,
  target: LogTarget,
  texts: LogTexts | null,
): void {
  reading.found.set(target.key, texts);
}

export function allSettled(reading: FileReading): boolean {
  return reading.targets.every((target) => reading.found.has(target.key));
}
