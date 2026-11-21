import { SESSION_MAX_ROWS, SESSION_PAGE_SIZE } from '../sessions/types.ts';

export function canShowMore(shown: number, total: number): boolean {
  return shown < total && shown < SESSION_MAX_ROWS;
}

export function nextLimit(limit: number): number {
  return Math.min(limit + SESSION_PAGE_SIZE, SESSION_MAX_ROWS);
}
