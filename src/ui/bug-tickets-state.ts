import { useEffect, useState } from 'react';
import type { FactoryResponse } from '../projects/types.ts';

export const BUG_TICKETS_KEY = 'factorydeck.bugTickets';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function storedBugTickets(): string[] {
  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(BUG_TICKETS_KEY) ?? '[]',
    );
    return Array.isArray(value)
      ? value.filter(
          (item): item is string => typeof item === 'string' && SLUG.test(item),
        )
      : [];
  } catch {
    return [];
  }
}

export function storeBugTickets(bugTickets: readonly string[]): void {
  try {
    if (bugTickets.length === 0)
      window.localStorage.removeItem(BUG_TICKETS_KEY);
    else
      window.localStorage.setItem(BUG_TICKETS_KEY, JSON.stringify(bugTickets));
  } catch {
    return;
  }
}

export function forgetBugTickets(slug: string): void {
  storeBugTickets(storedBugTickets().filter((item) => item !== slug));
}

export function useBugTickets(status: FactoryResponse | undefined): string[] {
  const [bugTickets, setBugTickets] = useState(storedBugTickets);
  const loaded = status?.status === 'ok' ? status.bugTickets : undefined;
  const key = loaded === undefined ? undefined : JSON.stringify(loaded);
  useEffect(() => {
    if (loaded === undefined) return;
    setBugTickets(loaded);
    storeBugTickets(loaded);
  }, [key]);
  return loaded ?? bugTickets;
}
