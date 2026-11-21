import type { IssueRecord, RequestRecord } from './types.ts';

export type Json = Record<string, unknown>;

export const PAGE_SIZE = 100;

export interface Changes {
  issues: IssueRecord[];
  requests: RequestRecord[];
}

export interface GitHostReader {
  changes: (since: Date | null) => Promise<Changes>;
  requests: (numbers: number[]) => Promise<RequestRecord[]>;
}

export function isJson(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function field(value: unknown, key: string): unknown {
  return isJson(value) ? value[key] : undefined;
}

export function list(value: unknown): Json[] {
  return Array.isArray(value) ? value.filter(isJson) : [];
}

export function objects(value: unknown, what: string): Json[] {
  if (!Array.isArray(value)) throw new Error(`Unexpected ${what} answer`);
  return value.filter(isJson);
}

export function object(value: unknown, what: string): Json {
  if (!isJson(value)) throw new Error(`Unexpected ${what} answer`);
  return value;
}

export function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function positive(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : undefined;
}

export function time(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null;
  const at = new Date(value);
  if (Number.isNaN(at.getTime()) || at.getUTCFullYear() < 1971) return null;
  return at.toISOString();
}

export function requiredTime(value: unknown, fallback: string): string {
  return time(value) ?? fallback;
}

export function labelColor(value: unknown): string | null {
  const color = text(value).trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{6}$/.test(color)) return `#${color}`;
  if (/^[0-9a-f]{3}$/.test(color)) {
    return `#${color.replaceAll(/[0-9a-f]/g, (digit) => digit + digit)}`;
  }
  return null;
}

export function byNumber<T extends { number: number }>(rows: T[]): T[] {
  const unique = new Map<number, T>();
  for (const row of rows) unique.set(row.number, row);
  return [...unique.values()];
}
