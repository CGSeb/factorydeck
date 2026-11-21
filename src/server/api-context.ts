import type { DatabaseCheck } from './health.ts';

export interface Unreachable {
  status: 'unreachable';
  refreshSeconds: number;
}

export interface ApiContext {
  refreshSeconds: number;
  updatedAt: () => string | null;
  fromDatabase: <T>(load: () => Promise<T>) => Promise<T | Unreachable>;
}

export function isTimeZone(value: string): boolean {
  try {
    return (
      new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions()
        .timeZone !== ''
    );
  } catch {
    return false;
  }
}

export function apiContext(
  checkDatabase: DatabaseCheck,
  refreshSeconds: number,
  updatedAt: () => Date | undefined,
): ApiContext {
  const unreachable: Unreachable = { status: 'unreachable', refreshSeconds };
  return {
    refreshSeconds,
    updatedAt: () => updatedAt()?.toISOString() ?? null,
    fromDatabase: async (load) => {
      if (!(await checkDatabase())) return unreachable;
      try {
        return await load();
      } catch (error) {
        if (await checkDatabase()) throw error;
        return unreachable;
      }
    },
  };
}
