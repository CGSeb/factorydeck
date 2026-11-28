import type { BrowserSource, Launch } from './browser.ts';
import type { HomeSource } from './home.ts';
import type { Http } from './http.ts';

export interface Output {
  out: (line: string) => void;
  err: (line: string) => void;
  terminal: boolean;
}

export interface Context extends HomeSource, BrowserSource, Http {
  hostname: string;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  launch: Launch;
  output: Output;
}

const MACHINE_LENGTH = 80;

export function machineName(hostname: string): string {
  const trimmed = hostname.trim();
  if (trimmed === '') return 'unknown';
  return Array.from(trimmed).slice(0, MACHINE_LENGTH).join('').trim();
}
