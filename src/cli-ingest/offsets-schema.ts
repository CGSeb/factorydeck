import { z } from 'zod';
import { type ReaderState, firstIssue } from './batch-schema.ts';

export const MAX_OFFSET_KEYS = 500;

export interface StoredOffset {
  readTo: number;
  parserVersion: number;
  readerState: ReaderState;
}

export interface OffsetsAnswer {
  offsets: Record<string, StoredOffset | null>;
}

export interface OffsetMismatch {
  fileKey: string;
  readTo: number;
}

export const OFFSET_MISMATCH = 'Offset mismatch';
export const TOO_MANY_FILE_KEYS = 'Too many file keys';

const offsetsRequestSchema = z.object({ fileKeys: z.array(z.string()) });

export type OffsetsCheck =
  | { status: 'ok'; fileKeys: string[] }
  | { status: 'invalid'; error: string; path: string }
  | { status: 'too-large' };

export function checkOffsetsRequest(value: unknown): OffsetsCheck {
  const parsed = offsetsRequestSchema.safeParse(value);
  if (!parsed.success) return firstIssue(parsed.error, 'Invalid request');
  const { fileKeys } = parsed.data;
  if (fileKeys.length > MAX_OFFSET_KEYS) return { status: 'too-large' };
  return { status: 'ok', fileKeys: [...new Set(fileKeys)] };
}
